import { mistral } from "@ai-sdk/mistral";
import { convertToModelMessages, streamText } from "ai";

export const POST = async (req: Request) => {
  const { messages } = await req.json();

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: mistral("mistral-large-latest"),
    system:
      "You are a helpful assistant that can answer questions and help with tasks.",
  });

  return result.toUIMessageStreamResponse();
};
