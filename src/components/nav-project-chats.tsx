import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareTextIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "./ui/empty";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./ui/sidebar";
import { Spinner } from "./ui/spinner";

export const NavProjectChats = ({ projectSlug }: { projectSlug: string }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const projectQueryOptions = useMemo(
    () => trpc.project.getProjectBySlug.queryOptions({ slug: projectSlug }),
    [projectSlug, trpc]
  );

  const projectQuery = useQuery(projectQueryOptions);

  const projectChatsQueryOptions = useMemo(
    () =>
      projectQuery.data
        ? trpc.chat.listProjectConversations.queryOptions({
            projectId: projectQuery.data.id,
          })
        : null,
    [projectQuery.data, trpc]
  );

  const chatsQuery = useQuery({
    ...(projectChatsQueryOptions ??
      trpc.chat.listProjectConversations.queryOptions({
        projectId: "placeholder",
      })),
    enabled: Boolean(projectChatsQueryOptions),
  });

  const [deleteCandidate, setDeleteCandidate] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const deleteConversationMutation = useMutation(
    trpc.chat.deleteConversation.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Unable to delete conversation");
      },
      onSuccess: async () => {
        if (projectChatsQueryOptions) {
          await queryClient.invalidateQueries({
            queryKey: projectChatsQueryOptions.queryKey,
          });
        }

        setDeleteCandidate(null);
        toast.success("Conversation deleted");
      },
    })
  );

  if (
    projectQuery.isPending ||
    (projectChatsQueryOptions && chatsQuery.isPending)
  ) {
    return (
      <SidebarMenu>
        <SidebarMenuSubItem>
          <SidebarMenuButton disabled tooltip="Loading chats">
            <Spinner />
            <span>Loading…</span>
          </SidebarMenuButton>
        </SidebarMenuSubItem>
      </SidebarMenu>
    );
  }

  if (projectQuery.isError || chatsQuery.isError) {
    return (
      <SidebarMenu>
        <SidebarMenuSubItem>
          <SidebarMenuButton disabled tooltip="Unable to load chats">
            <MessageSquareTextIcon aria-hidden="true" />
            <span>Unable to load</span>
          </SidebarMenuButton>
        </SidebarMenuSubItem>
      </SidebarMenu>
    );
  }

  if ((chatsQuery.data?.length ?? 0) === 0) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <Empty className="min-h-0 items-start justify-start gap-1 px-2 py-2 text-left">
            <EmptyHeader className="max-w-none items-start gap-1 text-left">
              <EmptyTitle className="text-xs font-medium">
                No Chats Yet
              </EmptyTitle>
              <EmptyDescription className="text-xs leading-relaxed">
                Start a chat to see it here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    );
  }

  return (
    <>
      <SidebarMenuSub>
        {chatsQuery.data?.map((chat) => (
          <SidebarMenuSubItem key={chat.id}>
            <div className="group flex items-center gap-1">
              <SidebarMenuSubButton asChild className="min-w-0 flex-1">
                <Link href={`/projects/${projectSlug}/chats/${chat.id}`}>
                  <MessageSquareTextIcon aria-hidden="true" />
                  <span className="truncate">{chat.title}</span>
                </Link>
              </SidebarMenuSubButton>

              <Button
                variant={"ghost"}
                size="icon-xs"
                className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                aria-label={`Delete ${chat.title}`}
                disabled={deleteConversationMutation.isPending}
                onClick={(event) => {
                  if (event.shiftKey) {
                    void deleteConversationMutation.mutateAsync({
                      conversationId: chat.id,
                      projectId: projectQuery.data.id,
                    });
                    return;
                  }

                  setDeleteCandidate({
                    id: chat.id,
                    title: chat.title ?? "",
                  });
                }}
              >
                <Trash2Icon aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>

      <AlertDialog
        open={deleteCandidate !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDeleteCandidate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate
                ? `This will permanently delete ${deleteCandidate.title}.`
                : "This will permanently delete this conversation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteConversationMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant={"destructive"}
              disabled={
                deleteConversationMutation.isPending || !deleteCandidate
              }
              onClick={() => {
                const conversationId = deleteCandidate?.id;
                if (!conversationId) {
                  return;
                }

                void deleteConversationMutation.mutateAsync({
                  conversationId: conversationId,
                  projectId: projectQuery.data.id,
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
