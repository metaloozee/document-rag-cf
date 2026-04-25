"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { useTRPC } from "@/lib/trpc/client";

import { Kbd, KbdGroup } from "../ui/kbd";

export const ProjectNewChatComposer = ({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const listProjectConversationsQueryOptions = useMemo(
    () =>
      trpc.chat.listProjectConversations.queryOptions({
        projectId,
      }),
    [projectId, trpc]
  );

  const startChat = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/chat/start", {
        body: JSON.stringify({
          projectId,
          projectSlug,
          text,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const raw = await response.text();
        let message = raw;
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed.error) {
            message = parsed.error;
          }
        } catch {
          // use raw text
        }
        throw new Error(message || "Failed to start chat");
      }

      return response.json() as Promise<{ chatId: string }>;
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to start chat";
      toast.error(message);
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: listProjectConversationsQueryOptions.queryKey,
      });
      router.push(
        `/projects/${encodeURIComponent(projectSlug)}/chats/${encodeURIComponent(data.chatId)}?stream=1`
      );
    },
  });

  const handleSubmit = useCallback(
    (message: { text: string }) => {
      const text = message.text.trim();
      if (text.length === 0 || startChat.isPending) {
        return;
      }

      startChat.mutate(text);
    },
    [startChat]
  );

  const submitStatus = startChat.isPending ? "submitted" : "ready";

  return (
    <div className="flex min-h-0 flex-1 flex-col relative">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col pb-2">
        <div className="relative mt-2 flex min-h-0 flex-1 flex-col">
          <Conversation className="min-h-0 flex-1">
            <ConversationContent>
              <ConversationEmptyState
                description="Type your own question below."
                icon={<MessageSquareIcon aria-hidden className="size-10" />}
                title="No messages yet"
              />
            </ConversationContent>
          </Conversation>
        </div>

        <div className="sticky bottom-0 z-10 mx-auto w-full max-w-4xl bg-background pb-2">
          <PromptInputProvider>
            <PromptInput globalDrop multiple onSubmit={handleSubmit}>
              <PromptInputBody>
                <PromptInputTextarea
                  autoComplete="off"
                  name="chat-message"
                  placeholder="Ask about your documents…"
                  spellCheck
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <span className="text-muted-foreground text-xs">
                    <KbdGroup>
                      <Kbd>Shift + Enter</Kbd> for newline
                    </KbdGroup>
                  </span>
                </PromptInputTools>
                <PromptInputSubmit status={submitStatus} />
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>
        </div>
      </div>
    </div>
  );
};
