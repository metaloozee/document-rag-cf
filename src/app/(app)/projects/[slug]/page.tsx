import { generateId } from "ai";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { Chat } from "@/components/chat/chat";
import { auth } from "@/lib/auth";
import { caller } from "@/lib/trpc/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const { slug } = await params;
  const project = await caller.project.getProjectBySlug({ slug });

  if (!project) {
    notFound();
  }

  const projectSummary = {
    description: project.description,
    id: project.id,
    name: project.name,
    slug: project.slug,
  };

  const chatId = await generateId();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <AppHeader project={projectSummary} />
      <Chat id={chatId} projectId={project.id} projectSlug={project.slug} />
    </div>
  );
}
