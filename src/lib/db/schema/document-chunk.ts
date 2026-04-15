import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";
import { projectDocument } from "./project-document";

export const documentChunk = pgTable(
  "document_chunk",
  {
    charEnd: integer("char_end"),
    charStart: integer("char_start"),
    chunkIndex: integer("chunk_index").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => projectDocument.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1024 }),
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    vectorId: text("vector_id").notNull(),
  },
  (table) => [
    uniqueIndex("document_chunk_document_chunk_unique").on(
      table.documentId,
      table.chunkIndex
    ),
    uniqueIndex("document_chunk_vector_id_unique").on(table.vectorId),
    index("document_chunk_project_created_idx").on(
      table.projectId,
      table.createdAt
    ),
    index("document_chunk_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt
    ),
  ]
);

export type DocumentChunk = typeof documentChunk.$inferSelect;
export type NewDocumentChunk = typeof documentChunk.$inferInsert;
