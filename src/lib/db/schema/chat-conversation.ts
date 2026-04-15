import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

export const chatConversation = pgTable(
  "chat_conversation",
  {
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title"),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chat_conversation_owner_project_updated_idx").on(
      table.ownerUserId,
      table.projectId,
      table.updatedAt
    ),
  ]
);

export type ChatConversation = typeof chatConversation.$inferSelect;
export type NewChatConversation = typeof chatConversation.$inferInsert;
