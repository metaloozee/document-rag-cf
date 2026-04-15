import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userSettings = pgTable("user_settings", {
  citeSourcesByDefault: boolean("cite_sources_by_default")
    .default(true)
    .notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  profileContext: text("profile_context"),
  responseStyle: text("response_style").default("balanced").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
