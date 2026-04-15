"use client";

import { ChevronRightIcon, FilesIcon, MessageSquareIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { NavProjectChats } from "@/components/nav-project-chats";
import { NavProjectDocuments } from "@/components/nav-project-documents";
import { ProjectSwitcher } from "@/components/project-switcher";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const SidebarCollections = ({ projectSlug }: { projectSlug: string }) => (
  <SidebarGroup>
    <SidebarMenu>
      <Collapsible asChild className="group/collapsible" defaultOpen>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip="Documents">
              <FilesIcon aria-hidden="true" />
              <span>Documents</span>
              <ChevronRightIcon
                aria-hidden="true"
                className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <NavProjectDocuments projectSlug={projectSlug} />
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      <Collapsible asChild className="group/collapsible" defaultOpen>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip="Chats">
              <MessageSquareIcon aria-hidden="true" />
              <span>Chats</span>
              <ChevronRightIcon
                aria-hidden="true"
                className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <NavProjectChats projectSlug={projectSlug} />
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  </SidebarGroup>
);

export const AppSidebar = ({
  project,
  ...props
}: ComponentProps<typeof Sidebar> & {
  project: {
    name: string;
    slug: string;
  };
}) => (
  <Sidebar collapsible="icon" {...props}>
    <SidebarHeader>
      <ProjectSwitcher currentProject={project} />
    </SidebarHeader>

    <SidebarContent>
      <SidebarCollections projectSlug={project.slug} />
    </SidebarContent>

    <SidebarFooter>
      <SidebarUserMenu />
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
);
