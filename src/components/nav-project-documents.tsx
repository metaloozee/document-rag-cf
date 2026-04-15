"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  FileCode2Icon,
  FileIcon,
  FileTextIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  documentListPollIntervalMs,
  isActiveDocumentProcessingStatus,
} from "@/components/projects/project-document-list-shared";
import type { ProjectDocumentListItem } from "@/components/projects/project-document-list-shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc/client";

const buildDocumentHref = (objectKey: string): string =>
  `/api/documents/${objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

const getDocumentTypePresentation = (
  filename: string,
  contentType: string | null
): {
  Icon: typeof FileIcon;
} => {
  const normalizedFilename = filename.toLowerCase();
  const normalizedContentType = contentType?.toLowerCase() ?? "";

  if (
    normalizedFilename.endsWith(".pdf") ||
    normalizedContentType === "application/pdf"
  ) {
    return {
      Icon: FileTextIcon,
    };
  }

  if (
    normalizedFilename.endsWith(".md") ||
    normalizedContentType === "text/markdown"
  ) {
    return {
      Icon: FileCode2Icon,
    };
  }

  if (
    normalizedFilename.endsWith(".txt") ||
    normalizedContentType.startsWith("text/plain")
  ) {
    return {
      Icon: FileTextIcon,
    };
  }

  if (
    normalizedFilename.endsWith(".doc") ||
    normalizedFilename.endsWith(".docx") ||
    normalizedContentType.includes("wordprocessingml") ||
    normalizedContentType.includes("msword")
  ) {
    return {
      Icon: FileTextIcon,
    };
  }

  return {
    Icon: FileIcon,
  };
};

export const NavProjectDocuments = ({
  projectSlug,
}: {
  projectSlug: string;
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const projectQueryOptions = useMemo(
    () =>
      trpc.project.getProjectBySlug.queryOptions({
        slug: projectSlug,
      }),
    [projectSlug, trpc]
  );

  const projectQuery = useQuery(projectQueryOptions);

  const projectDocumentsQueryOptions = useMemo(
    () =>
      projectQuery.data
        ? trpc.project.listProjectDocuments.queryOptions({
            projectId: projectQuery.data.id,
          })
        : null,
    [projectQuery.data, trpc]
  );

  const documentsQuery = useQuery({
    ...(projectDocumentsQueryOptions ??
      trpc.project.listProjectDocuments.queryOptions({
        projectId: "placeholder",
      })),
    enabled: Boolean(projectDocumentsQueryOptions),
    refetchInterval: (query) => {
      const documents = query.state.data as
        | ProjectDocumentListItem[]
        | undefined;

      return documents?.some((document) =>
        isActiveDocumentProcessingStatus(document.processingStatus)
      )
        ? documentListPollIntervalMs
        : false;
    },
    refetchIntervalInBackground: true,
  });
  const [deleteCandidate, setDeleteCandidate] = useState<{
    id: string;
    originalFilename: string;
  } | null>(null);

  const deleteDocumentMutation = useMutation(
    trpc.project.deleteProjectDocument.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Unable to delete document");
      },
      onSuccess: async () => {
        if (projectDocumentsQueryOptions) {
          await queryClient.invalidateQueries({
            queryKey: projectDocumentsQueryOptions.queryKey,
          });
        }

        setDeleteCandidate(null);
        toast.success("Document deleted");
      },
    })
  );
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(
    null
  );
  const [renameValue, setRenameValue] = useState("");
  const renameDocumentMutation = useMutation(
    trpc.project.updateProjectDocument.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Unable to rename document");
      },
      onSuccess: async () => {
        if (projectDocumentsQueryOptions) {
          await queryClient.invalidateQueries({
            queryKey: projectDocumentsQueryOptions.queryKey,
          });
        }

        setRenamingDocumentId(null);
        setRenameValue("");
        toast.success("Document renamed");
      },
    })
  );

  if (
    projectQuery.isPending ||
    (projectDocumentsQueryOptions && documentsQuery.isPending)
  ) {
    return (
      <SidebarMenu>
        <SidebarMenuSubItem>
          <SidebarMenuButton disabled tooltip="Loading documents">
            <FileTextIcon aria-hidden="true" />
            <span>Loading…</span>
          </SidebarMenuButton>
        </SidebarMenuSubItem>
      </SidebarMenu>
    );
  }

  if (projectQuery.isError || documentsQuery.isError) {
    return (
      <SidebarMenu>
        <SidebarMenuSubItem>
          <SidebarMenuButton disabled tooltip="Unable to load documents">
            <FileTextIcon aria-hidden="true" />
            <span>Unable to load</span>
          </SidebarMenuButton>
        </SidebarMenuSubItem>
      </SidebarMenu>
    );
  }

  if ((documentsQuery.data?.length ?? 0) === 0) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <Empty className="min-h-0 items-start justify-start gap-1 px-2 py-2 text-left">
            <EmptyHeader className="max-w-none items-start gap-1 text-left">
              <EmptyTitle className="text-xs font-medium">
                No Documents Uploaded
              </EmptyTitle>
              <EmptyDescription className="text-xs leading-relaxed">
                Upload documents to see them here.
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
        {documentsQuery.data?.map((document) => {
          const { Icon } = getDocumentTypePresentation(
            document.originalFilename,
            document.contentType
          );
          const isRenaming = renamingDocumentId === document.id;
          const isProcessing = isActiveDocumentProcessingStatus(
            document.processingStatus
          );
          const isFailed = document.processingStatus === "failed";

          let documentButton: React.ReactNode;

          if (isRenaming) {
            documentButton = (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <div className="flex size-7 shrink-0 items-center justify-center">
                  <Icon aria-hidden="true" className="size-4" />
                </div>
                <Input
                  value={renameValue}
                  maxLength={255}
                  className="h-7 bg-background px-2 text-xs"
                  aria-label={`Rename ${document.originalFilename}`}
                  onChange={(event) => {
                    setRenameValue(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setRenamingDocumentId(null);
                      setRenameValue("");
                    }

                    if (
                      event.key === "Enter" &&
                      renameValue.trim().length > 0 &&
                      !renameDocumentMutation.isPending
                    ) {
                      event.preventDefault();
                      void renameDocumentMutation.mutateAsync({
                        id: document.id,
                        originalFilename: renameValue.trim(),
                      });
                    }
                  }}
                />
              </div>
            );
          } else if (isProcessing) {
            documentButton = (
              <Button
                variant="ghost"
                className="h-7 min-w-0 flex-1 justify-start"
                disabled
              >
                <Spinner
                  className="size-3.5"
                  aria-label="Processing document"
                />
                <span className="truncate">{document.originalFilename}</span>
              </Button>
            );
          } else {
            documentButton = (
              <SidebarMenuSubButton asChild className="min-w-0 flex-1">
                <Link
                  href={buildDocumentHref(document.objectKey)}
                  target="_blank"
                  rel="noopener"
                >
                  <Icon aria-hidden="true" />
                  <span className="truncate">{document.originalFilename}</span>
                </Link>
              </SidebarMenuSubButton>
            );
          }

          let statusIndicator: React.ReactNode = null;

          if (isFailed) {
            statusIndicator = (
              <div
                className="flex size-7 items-center justify-center text-destructive"
                title={document.processingError ?? "Document processing failed"}
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </div>
            );
          }

          const showRenameAction = isProcessing === false;

          return (
            <SidebarMenuSubItem key={document.id}>
              <div className="group flex items-center gap-1">
                {documentButton}

                {isRenaming ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Save ${document.originalFilename}`}
                      disabled={
                        renameDocumentMutation.isPending ||
                        renameValue.trim().length === 0
                      }
                      onClick={() => {
                        void renameDocumentMutation.mutateAsync({
                          id: document.id,
                          originalFilename: renameValue.trim(),
                        });
                      }}
                    >
                      <CheckIcon aria-hidden="true" className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Cancel renaming ${document.originalFilename}`}
                      onClick={() => {
                        setRenamingDocumentId(null);
                        setRenameValue("");
                      }}
                    >
                      <XIcon aria-hidden="true" className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    {statusIndicator}

                    {showRenameAction ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        aria-label={`Rename ${document.originalFilename}`}
                        onClick={() => {
                          setRenamingDocumentId(document.id);
                          setRenameValue(document.originalFilename);
                        }}
                      >
                        <PencilIcon aria-hidden="true" className="size-3.5" />
                      </Button>
                    ) : null}

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      aria-label={`Delete ${document.originalFilename}`}
                      disabled={deleteDocumentMutation.isPending}
                      onClick={(event) => {
                        if (event.shiftKey) {
                          void deleteDocumentMutation.mutateAsync({
                            id: document.id,
                          });
                          return;
                        }

                        setDeleteCandidate({
                          id: document.id,
                          originalFilename: document.originalFilename,
                        });
                      }}
                    >
                      <Trash2Icon aria-hidden="true" className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </SidebarMenuSubItem>
          );
        })}
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
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate
                ? `This will permanently delete ${deleteCandidate.originalFilename}.`
                : "This will permanently delete this document."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDocumentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteDocumentMutation.isPending || !deleteCandidate}
              onClick={() => {
                const documentId = deleteCandidate?.id;

                if (!documentId) {
                  return;
                }

                void deleteDocumentMutation.mutateAsync({
                  id: documentId,
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
