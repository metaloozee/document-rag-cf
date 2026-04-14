import { mistral } from "@ai-sdk/mistral";
import { convertToModelMessages, streamText, validateUIMessages } from "ai";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";

const requestBodySchema = z.object({
  id: z.string().length(16),
  messages: z.unknown(),
  projectId: z.string().uuid(),
  projectSlug: z.string(),
});

export const POST = async (req: Request) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = requestBodySchema.parse(await req.json());
  const messages = await validateUIMessages({ messages: body.messages });

  console.log(`${body.projectSlug}:${body.id}`);
  console.log(
    "messages",
    messages.map((m) => m.parts.map((p) => p))
  );
  console.log(
    "current message",
    messages.at(-1)?.parts.map((p) => p)
  );

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: mistral("mistral-large-latest"),
    system:
      "You are a helpful assistant that can answer questions and help with tasks.",
  });

  return result.toUIMessageStreamResponse();
};
