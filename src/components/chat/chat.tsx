"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { AlertCircle, CopyIcon, MessageSquareIcon } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { Kbd, KbdGroup } from "../ui/kbd";

const getMessagePlainText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");

interface ChatMessageRowProps {
  message: UIMessage;
}

const ChatMessageRow = ({ message }: ChatMessageRowProps) => {
  const handleCopy = useCallback(async () => {
    const text = getMessagePlainText(message);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy. Try selecting the text instead.");
    }
  }, [message]);

  return (
    <Message className="min-w-0" from={message.role}>
      <MessageContent>
        {message.parts.map((part, i) =>
          part.type === "text" ? (
            <MessageResponse key={`${message.id}-text-${i}`}>
              {part.text}
            </MessageResponse>
          ) : null
        )}
      </MessageContent>
      <MessageActions
        className={cn(
          "opacity-0 transition-opacity duration-200 motion-reduce:transition-none",
          "group-hover:opacity-100 focus-within:opacity-100",
          message.role === "user" ? "self-end" : "self-start"
        )}
      >
        <MessageAction
          label="Copy message"
          onClick={handleCopy}
          tooltip="Copy message"
        >
          <CopyIcon aria-hidden className="size-4" />
        </MessageAction>
      </MessageActions>
    </Message>
  );
};

export const Chat = () => {
  const { messages, sendMessage, status, stop, regenerate, error, clearError } =
    useChat({
      transport: new DefaultChatTransport({
        api: "/api/chat",
      }),
    });

  const handleSubmit = (message: { text: string }) => {
    sendMessage(message);
  };

  const showThinking =
    status === "submitted" && messages.at(-1)?.role !== "assistant";

  const isComposerBusy = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-0 flex-1 flex-col relative">
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-4 pb-2 lg:max-w-5xl lg:px-6">
        {error ? (
          <Alert className="mt-4 shrink-0" role="alert" variant="destructive">
            <AlertCircle aria-hidden className="size-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Try again, or dismiss to keep editing your message.</span>
              <span className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    void regenerate();
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Retry
                </Button>
                <Button
                  onClick={() => {
                    clearError();
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Dismiss
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="relative mt-2 flex min-h-0 flex-1 flex-col">
          <Conversation className="min-h-0 flex-1">
            <ConversationContent>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  description="Type your own question below."
                  icon={<MessageSquareIcon aria-hidden className="size-10" />}
                  title="No messages yet"
                />
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatMessageRow key={message.id} message={message} />
                  ))}
                  {showThinking ? (
                    <div
                      aria-live="polite"
                      className="flex items-center gap-2 text-muted-foreground text-sm"
                    >
                      <Spinner className="size-4" />
                      <span>Thinking…</span>
                    </div>
                  ) : null}
                </>
              )}
            </ConversationContent>
            <ConversationScrollButton aria-label="Scroll to latest message" />
          </Conversation>
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 pt-3 pb-4">
          <PromptInputProvider>
            <PromptInput globalDrop multiple onSubmit={handleSubmit}>
              <PromptInputBody>
                <PromptInputTextarea
                  autoComplete="off"
                  disabled={isComposerBusy}
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
                <PromptInputSubmit onStop={stop} status={status} />
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>
        </div>
      </div>
    </div>
  );
};
