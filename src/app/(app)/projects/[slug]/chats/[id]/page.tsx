import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { Chat } from "@/components/chat/chat";
import { auth } from "@/lib/auth";
import { caller } from "@/lib/trpc/server";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; slug: string }>;
  searchParams: Promise<{ stream?: string }>;
}) {
  const [session, { id: chatId, slug: projectSlug }, { stream: streamParam }] =
    await Promise.all([
      headers().then((requestHeaders) =>
        auth.api.getSession({ headers: requestHeaders })
      ),
      params,
      searchParams,
    ]);

  if (!session?.user) {
    redirect("/login");
  }

  const project = await caller.project.getProjectBySlug({ slug: projectSlug });

  if (!project) {
    notFound();
  }

  const { conversation, messages: initialMessages } = await (async () => {
    try {
      return await caller.chat.getConversationThread({
        conversationId: chatId,
        projectId: project.id,
      });
    } catch (error) {
      if (error instanceof TRPCError && error.code === "NOT_FOUND") {
        notFound();
      }

      throw error;
    }
  })();

  const shouldAutoStartStream =
    streamParam === "1" &&
    initialMessages.length === 1 &&
    initialMessages[0]?.role === "user";

  const projectSummary = {
    description: project.description,
    id: project.id,
    name: project.name,
    slug: project.slug,
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <AppHeader chatTitle={conversation.title} project={projectSummary} />
      <Chat
        id={chatId}
        autoStartStream={shouldAutoStartStream}
        initialMessages={initialMessages}
        projectId={project.id}
        projectSlug={project.slug}
      />
    </div>
  );
}
