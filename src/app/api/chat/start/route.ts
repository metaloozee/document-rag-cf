import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateAndSaveConversationAiTitle } from "@/lib/chat/generate-conversation-ai-title";
import { getOwnedProject } from "@/lib/documents/ingestion";
import { caller } from "@/lib/trpc/server";

const bodySchema = z.object({
  projectId: z.string().min(1),
  projectSlug: z.string().trim().min(1),
  text: z.string().trim().min(1).max(50_000),
});

export const POST = async (req: Request) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = bodySchema.parse(await req.json());

  const project = await getOwnedProject({
    ownerUserId: session.user.id,
    projectId: body.projectId,
  });

  if (!project || project.slug !== body.projectSlug) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  let chatId: string;

  try {
    const result = await caller.chat.startNewConversationWithFirstMessage({
      projectId: body.projectId,
      text: body.text,
    });
    ({ chatId } = result);
  } catch (error) {
    if (error instanceof TRPCError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return Response.json({ error: error.message }, { status });
    }

    throw error;
  }

  const firstUserPlainText = body.text;
  const { projectId } = body;
  const conversationId = chatId;

  after(async () => {
    try {
      await generateAndSaveConversationAiTitle({
        conversationId,
        firstUserPlainText,
        projectId,
      });
    } catch (titleError) {
      console.error(
        "Failed to generate or save AI conversation title",
        titleError
      );
    }
  });

  return Response.json({ chatId });
};
