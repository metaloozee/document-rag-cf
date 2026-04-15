import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { Chat } from "@/components/chat/chat";
import { auth } from "@/lib/auth";
import { caller } from "@/lib/trpc/server";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const { id: chatId, slug: projectSlug } = await params;
  const project = await caller.project.getProjectBySlug({ slug: projectSlug });

  if (!project) {
    notFound();
  }

  try {
    await caller.chat.getConversationById({
      conversationId: chatId,
      projectId: project.id,
    });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }

    throw error;
  }

  const initialMessages = await caller.chat.getConversationMessages({
    conversationId: chatId,
    projectId: project.id,
  });

  const projectSummary = {
    description: project.description,
    id: project.id,
    name: project.name,
    slug: project.slug,
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <AppHeader project={projectSummary} />
      <Chat
        id={chatId}
        initialMessages={initialMessages}
        projectId={project.id}
        projectSlug={project.slug}
      />
    </div>
  );
}
