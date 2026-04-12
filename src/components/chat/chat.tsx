"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import React from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

export const Chat = () => {
  const [text, setText] = React.useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage({ text });
    setText("");
  };

  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) =>
        m.parts.map((p) =>
          p.type === "text" ? <div key={m.id + p.text}>{p.text}</div> : null
        )
      )}

      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} />

        <Button type="submit" disabled={status !== "ready"}>
          Send
        </Button>
      </div>
    </form>
  );
};
