import { mistral } from "@ai-sdk/mistral";
import type { UIMessage } from "ai";
import {
  convertToModelMessages,
  createIdGenerator,
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
          title: "Undefined Conversation",
        })
      : await caller.chat.getConversationById({
          conversationId: body.id,
          projectId: body.projectId,
        });

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: mistral("mistral-large-latest"),
    system:
      "You are a helpful assistant that can answer questions and help with tasks.",
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
