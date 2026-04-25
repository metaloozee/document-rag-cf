import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { ProjectNewChatComposer } from "@/components/chat/project-new-chat-composer";
import { auth } from "@/lib/auth";
import { caller } from "@/lib/trpc/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [session, { slug }] = await Promise.all([
    headers().then((requestHeaders) =>
      auth.api.getSession({ headers: requestHeaders })
    ),
    params,
  ]);

  if (!session?.user) {
    redirect("/login");
  }

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

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <AppHeader project={projectSummary} />
      <ProjectNewChatComposer
        projectId={project.id}
        projectSlug={project.slug}
      />
    </div>
  );
}
