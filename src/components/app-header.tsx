"use client";

import { Settings2Icon, SlidersHorizontalIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ProjectSettingsDialog } from "@/components/projects/project-settings-dialog";
import { ProjectUploadDocumentsDialog } from "@/components/projects/project-upload-documents-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface AppHeaderProject {
  description: string | null;
  id: string;
  name: string;
  slug: string;
}

export const AppHeader = ({
  chatTitle,
  project,
}: {
  chatTitle?: string | null;
  project: AppHeaderProject;
}) => {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const normalizedChatTitle = chatTitle?.trim() ?? "";
  const hasChatTitle = normalizedChatTitle.length > 0;

  return (
    <header className="sticky z-2 bg-background w-full flex py-2 shrink-0 items-center gap-2 border-b px-3 sm:gap-4 sm:px-4">
      <SidebarTrigger />
      <Separator
        className="my-auto hidden size-4 sm:block"
        orientation="vertical"
      />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="hidden sm:flex">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {hasChatTitle ? (
              <BreadcrumbLink asChild>
                <Link href={`/projects/${project.slug}`}>{project.name}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{project.name}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {hasChatTitle ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">
                  {normalizedChatTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>

        <BreadcrumbList className="sm:hidden">
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">
              {hasChatTitle ? normalizedChatTitle : project.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden"
              aria-label="Open project actions"
            >
              <SlidersHorizontalIcon aria-hidden="true" />
              Manage
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 sm:hidden">
            <DropdownMenuItem onSelect={() => setIsUploadDialogOpen(true)}>
              <UploadIcon aria-hidden="true" />
              Upload Documents
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsSettingsDialogOpen(true)}>
              <Settings2Icon aria-hidden="true" />
              Project Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ProjectUploadDocumentsDialog
          projectId={project.id}
          open={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          triggerClassName="hidden sm:inline-flex"
        />
        <ProjectSettingsDialog
          project={project}
          projectSlug={project.slug}
          open={isSettingsDialogOpen}
          onOpenChange={setIsSettingsDialogOpen}
          triggerClassName="hidden sm:inline-flex"
        />
      </div>
    </header>
  );
};
