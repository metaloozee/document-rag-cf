import { mistral } from "@ai-sdk/mistral";
import type { UIMessage } from "ai";
import {
  convertToModelMessages,
  createIdGenerator,
  embedMany,
  generateText,
  Output,
  streamText,
  TypeValidationError,
  validateUIMessages,
} from "ai";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  documentChunk,
  documentEmbedding,
  projectDocument,
} from "@/lib/db/schema";
import type { ChatConversation } from "@/lib/db/schema";
import {
  DOCUMENT_EMBEDDING_DIMENSIONS,
  getOwnedProject,
} from "@/lib/documents/ingestion";
import { caller } from "@/lib/trpc/server";

const FIRST_MESSAGE_TITLE_CONTEXT_MAX = 2000;
const RETRIEVAL_RESULTS_PER_QUERY = 8;
const MAX_RETRIEVED_CONTEXTS = 12;
const MAX_RETRIEVED_CONTEXT_CHARS = 16_000;

interface RetrievedChatContext {
  chunkId: string;
  chunkIndex: number;
  content: string;
  documentId: string;
  originalFilename: string;
  similarity: number;
}

const conversationTitleSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("Short plain-text title for this chat thread."),
});

const getMessagePlainText = (message: UIMessage | undefined): string => {
  if (!message) {
    return "";
  }

  return message.parts
    .filter(
      (
        part
      ): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text"
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
};

const getFirstUserMessagePlainText = (messageList: UIMessage[]): string => {
  const firstUser = messageList.find((m) => m.role === "user");

  return getMessagePlainText(firstUser);
};

const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(",")}]`;

const searchDocumentContexts = ({
  embedding,
  ownerUserId,
  projectId,
}: {
  embedding: number[];
  ownerUserId: string;
  projectId: string;
}): Promise<RetrievedChatContext[]> => {
  const queryVector = sql`${toVectorLiteral(embedding)}::vector`;
  const distance = sql<number>`${documentEmbedding.embedding} <=> ${queryVector}`;
  const similarity = sql<number>`1 - (${distance})`;

  return db
    .select({
      chunkId: documentChunk.id,
      chunkIndex: documentChunk.chunkIndex,
      content: documentChunk.text,
      documentId: projectDocument.id,
      originalFilename: projectDocument.originalFilename,
      similarity,
    })
    .from(documentEmbedding)
    .innerJoin(documentChunk, eq(documentEmbedding.chunkId, documentChunk.id))
    .innerJoin(
      projectDocument,
      eq(documentEmbedding.documentId, projectDocument.id)
    )
    .where(
      and(
        eq(documentEmbedding.ownerUserId, ownerUserId),
        eq(documentEmbedding.projectId, projectId),
        eq(projectDocument.processingStatus, "ready")
      )
    )
    .orderBy(distance)
    .limit(RETRIEVAL_RESULTS_PER_QUERY);
};

const formatRetrievedContexts = (contexts: RetrievedChatContext[]): string => {
  if (contexts.length === 0) {
    return "No relevant document context was retrieved for this request.";
  }

  let totalLength = 0;
  const sections: string[] = [];

  for (const [index, context] of contexts.entries()) {
    const section = [
      `[${index + 1}] ${context.originalFilename} (chunk ${context.chunkIndex + 1}, similarity ${context.similarity.toFixed(3)})`,
      context.content,
    ].join("\n");

    if (totalLength + section.length > MAX_RETRIEVED_CONTEXT_CHARS) {
      break;
    }

    sections.push(section);
    totalLength += section.length;
  }

  return sections.join("\n\n---\n\n");
};

const scheduleAiConversationTitle = ({
  conversationId,
  firstUserPlainText,
  projectId,
}: {
  conversationId: string;
  firstUserPlainText: string;
  projectId: string;
}) => {
  if (firstUserPlainText.length === 0) {
    return;
  }

  const context = firstUserPlainText.slice(0, FIRST_MESSAGE_TITLE_CONTEXT_MAX);

  void (async () => {
    try {
      const { output } = await generateText({
        model: mistral("mistral-small-latest"),
        output: Output.object({
          description: "A concise title for the chat thread.",
          name: "ConversationTitle",
          schema: conversationTitleSchema,
        }),
        prompt: `The user started the conversation with:\n\n${context}`,
        system:
          "Name the chat thread in a few words based on the user's message.",
        temperature: 0.4,
      });

      const title = output.title.trim();
      if (title.length === 0) {
        return;
      }

      await caller.chat.updateConversationTitle({
        conversationId,
        projectId,
        title,
      });
    } catch (error) {
      console.error("Failed to generate or save AI conversation title", error);
    }
  })();
};

const requestBodySchema = z.object({
  id: z.string().length(16),
  messages: z.unknown(),
  projectId: z.string().min(1),
  projectSlug: z.string().trim().min(1),
});

export const POST = async (req: Request) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ownerUserId = session.user.id;
  const body = requestBodySchema.parse(await req.json());

  const project = await getOwnedProject({
    ownerUserId,
    projectId: body.projectId,
  });

  if (!project || project.slug !== body.projectSlug) {
    return new Response("Project not found", { status: 404 });
  }

  let messages: UIMessage[];

  try {
    messages = await validateUIMessages({ messages: body.messages });
  } catch (error) {
    if (error instanceof TypeValidationError) {
      return new Response("Failed to validate messages", { status: 400 });
    }

    throw error;
  }

  const conversation: ChatConversation =
    messages.length === 1
      ? await caller.chat.createConversation({
          id: body.id,
          projectId: body.projectId,
          title: "New conversation",
        })
      : await caller.chat.getConversationById({
          conversationId: body.id,
          projectId: body.projectId,
        });

  if (messages.length === 1) {
    scheduleAiConversationTitle({
      conversationId: conversation.id,
      firstUserPlainText: getFirstUserMessagePlainText(messages),
      projectId: body.projectId,
    });
  }

  const { output: queriesToEmbed } = await generateText({
    model: mistral("mistral-large-latest"),
    output: Output.array({
      description: "A list of queries to embed for semantic search.",
      element: z.string().trim().min(1).max(300),
      name: "QueriesToEmbed",
    }),
    prompt: `
      You are a helpful AI assistant specialized in retrieval search. Given the user's prompt, generate 3 to 6 focused search queries that will be embedded to perform semantic search over the project's documents.
      User prompt: ${getMessagePlainText(messages.at(-1))}
      `,
  });

  const { embeddings } = await embedMany({
    model: mistral.embeddingModel("mistral-embed"),
    values: queriesToEmbed,
  });

  if (
    embeddings.length <= 0 ||
    embeddings.some(
      (embedding) => embedding.length !== DOCUMENT_EMBEDDING_DIMENSIONS
    )
  ) {
    return new Response("An error occurred while embedding the queries", {
      status: 500,
    });
  }

  const searchPromises: Promise<RetrievedChatContext[]>[] = [];

  for (const embedding of embeddings) {
    searchPromises.push(
      searchDocumentContexts({
        embedding,
        ownerUserId,
        projectId: body.projectId,
      })
    );
  }

  const contextsByChunkId = new Map<string, RetrievedChatContext>();
  const searchResults = await Promise.all(searchPromises);

  for (const contexts of searchResults) {
    for (const context of contexts) {
      const existingContext = contextsByChunkId.get(context.chunkId);

      if (!existingContext || context.similarity > existingContext.similarity) {
        contextsByChunkId.set(context.chunkId, context);
      }
    }
  }

  const retrievedContexts = [...contextsByChunkId.values()]
    .toSorted((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_RETRIEVED_CONTEXTS);
  const retrievedContextText = formatRetrievedContexts(retrievedContexts);

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: mistral("mistral-large-latest"),
    system: `
      You are a helpful assistant named OpenBookLM that can answer questions and help with tasks.
      Use the retrieved document context below to answer the user's question. If the context does not contain the answer, say that the uploaded documents do not contain enough information and then provide any generally useful guidance separately.

      ## Retrieved document context
      ${retrievedContextText}

      For mathematical expressions, OpenBookLM uses double dollar signs ($$) to delimit mathematical expressions. Unlike traditional LaTeX, single dollar signs ($) are not used by default to avoid conflicts with currency symbols in regular text.

      ## Inline Math:
      Wrap inline mathematical expressions with \`$$\`.
      For example: 
      The quadratic formula is $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$ for solving equations.

      ## Block Math:
      For display-style equations, place \`$$\` delimiters on separate lines.
      For example:
      $$
      E = mc^2
      $$

      ## Common Mathematical Expressions:
      ### Fractions:
      $$\\frac{numerator}{denominator}$$

      ### Square Roots:
      $$\\sqrt{x}$$ or $$\\sqrt[n]{x}$$

      ### Exponents and Subscripts:
      $$x^2$$ or $$x_i$$ or $$x_i^2$$

      ## Advanced Examples:
      ### The Quadratic Formula:
      $$
      x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
      $$

      ### Normal Distribution:
      $$
      f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}
      $$
      `,
  });

  result.consumeStream();

  return result.toUIMessageStreamResponse({
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
    onFinish: async ({ messages: finishedMessages }) => {
      try {
        await caller.chat.syncConversationMessages({
          conversationId: conversation.id,
          messages: finishedMessages,
          projectId: conversation.projectId,
        });
      } catch {
        // Response already streamed; log for observability.
        console.error("Failed to persist chat messages after stream finished");
      }
    },
    originalMessages: messages,
  });
};
