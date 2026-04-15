import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

export const projectDocument = pgTable(
  "project_document",
  {
    chunkCount: integer("chunk_count").default(0).notNull(),
    contentType: text("content_type"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    id: text("id").primaryKey(),
    ingestionVersion: integer("ingestion_version").default(1).notNull(),
    lastIngestionAttemptAt: timestamp("last_ingestion_attempt_at", {
      mode: "date",
    }),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    processedAt: timestamp("processed_at", { mode: "date" }),
    processingError: text("processing_error"),
    processingStartedAt: timestamp("processing_started_at", {
      mode: "date",
    }),
    processingStatus: text("processing_status").default("queued").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sizeBytes: integer("size_bytes").notNull(),
    sourceTextObjectKey: text("source_text_object_key"),
    vectorCount: integer("vector_count").default(0).notNull(),
  },
  (table) => [
    index("project_document_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt
    ),
    index("project_document_project_created_idx").on(
      table.projectId,
      table.createdAt
    ),
    index("project_document_project_status_created_idx").on(
      table.projectId,
      table.processingStatus,
      table.createdAt
    ),
    uniqueIndex("project_document_object_key_unique").on(table.objectKey),
  ]
);

export type ProjectDocument = typeof projectDocument.$inferSelect;
export type NewProjectDocument = typeof projectDocument.$inferInsert;
