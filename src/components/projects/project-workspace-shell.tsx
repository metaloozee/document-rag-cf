import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { caller } from "@/lib/trpc/server";

export const ProjectWorkspaceShell = async ({
  children,
  slug,
}: {
  children: ReactNode;
  slug: string;
}) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const projectRecord = await caller.project.getProjectBySlug({ slug });
  if (!projectRecord) {
    notFound();
  }

  const projectSummary = {
    description: projectRecord.description,
    id: projectRecord.id,
    name: projectRecord.name,
    slug: projectRecord.slug,
  };

  return (
    <SidebarProvider>
      <AppSidebar project={projectSummary} />
      <SidebarInset className="flex flex-col">{children}</SidebarInset>
    </SidebarProvider>
  );
};
