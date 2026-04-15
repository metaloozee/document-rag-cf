import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { chatConversation } from "./chat-conversation";
import { project } from "./project";

export const chatMessage = pgTable(
  "chat_message",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => chatConversation.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parts: jsonb("parts").notNull().$type<unknown[]>(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    sequence: integer("sequence").notNull(),
  },
  (table) => [
    index("chat_message_conversation_sequence_idx").on(
      table.conversationId,
      table.sequence
    ),
  ]
);

export type ChatMessage = typeof chatMessage.$inferSelect;
export type NewChatMessage = typeof chatMessage.$inferInsert;
