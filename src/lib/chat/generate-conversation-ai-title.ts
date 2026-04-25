import { mistral } from "@ai-sdk/mistral";
import { generateText, Output } from "ai";
import { z } from "zod";

import { caller } from "@/lib/trpc/server";

const FIRST_MESSAGE_TITLE_CONTEXT_MAX = 2000;

const conversationTitleSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("Short plain-text title for this chat thread."),
});

export const generateAndSaveConversationAiTitle = async ({
  conversationId,
  firstUserPlainText,
  projectId,
}: {
  conversationId: string;
  firstUserPlainText: string;
  projectId: string;
}): Promise<void> => {
  if (firstUserPlainText.length === 0) {
    return;
  }

  const context = firstUserPlainText.slice(0, FIRST_MESSAGE_TITLE_CONTEXT_MAX);

  const { output } = await generateText({
    model: mistral("mistral-small-latest"),
    output: Output.object({
      description: "A concise title for the chat thread.",
      name: "ConversationTitle",
      schema: conversationTitleSchema,
    }),
    prompt: `The user started the conversation with:\n\n${context}`,
    system: "Name the chat thread in a few words based on the user's message.",
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
};
