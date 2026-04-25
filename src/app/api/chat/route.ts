import { mistral } from "@ai-sdk/mistral";
import type { UIMessage } from "ai";
import {
  convertToModelMessages,
  createIdGenerator,
  generateText,
  Output,
  streamText,
  TypeValidationError,
  validateUIMessages,
} from "ai";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import type { ChatConversation } from "@/lib/db/schema";
import { getOwnedProject } from "@/lib/documents/ingestion";
import { caller } from "@/lib/trpc/server";

const FIRST_MESSAGE_TITLE_CONTEXT_MAX = 2000;

const conversationTitleSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("Short plain-text title for this chat thread."),
});

const getFirstUserMessagePlainText = (messageList: UIMessage[]): string => {
  const firstUser = messageList.find((m) => m.role === "user");
  if (!firstUser) {
    return "";
  }

  return firstUser.parts
    .filter(
      (
        part
      ): part is Extract<(typeof firstUser.parts)[number], { type: "text" }> =>
        part.type === "text"
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
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

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: mistral("mistral-large-latest"),
    system: `
      You are a helpful assistant named OpenBookLM that can answer questions and help with tasks.
      For mathematical expressions, OpenBookLM uses double dollar signs ($$) to delimit mathematical expressions. Unlike traditional LaTeX, single dollar signs ($) are not used by default to avoid conflicts with currency symbols in regular text.

      ## Inline Math:
      Wrap inline mathematical expressions with \`$$\`.
      For example: 
      \`\`\`
      The quadratic formula is $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$ for solving equations.
      \`\`\`

      ## Block Math:
      For display-style equations, place \`$$\` delimiters on separate lines.
      For example:
      \`\`\`
      $$
      E = mc^2
      $$
      \`\`\`
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
