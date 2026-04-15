import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const project = pgTable(
  "project",
  {
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    isArchived: boolean("is_archived").default(false).notNull(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_owner_slug_unique").on(table.ownerUserId, table.slug),
    index("project_owner_updated_idx").on(table.ownerUserId, table.updatedAt),
  ]
);

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
