import { index, pgTable, text, uniqueIndex, vector } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { documentChunk } from "./document-chunk";
import { project } from "./project";
import { projectDocument } from "./project-document";

export const documentEmbedding = pgTable(
  "document_embedding",
  {
    chunkId: text("chunk_id")
      .notNull()
      .references(() => documentChunk.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => projectDocument.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    vectorId: text("vector_id").notNull(),
  },
  (table) => [
    uniqueIndex("document_embedding_chunk_id_unique").on(table.chunkId),
    uniqueIndex("document_embedding_vector_id_unique").on(table.vectorId),
    index("document_embedding_project_document_idx").on(
      table.projectId,
      table.documentId
    ),
    index("document_embedding_similarity_idx")
      .using("hnsw", table.embedding.op("vector_cosine_ops"))
      .with({
        ef_construction: 64,
        m: 16,
      }),
  ]
);

export type DocumentEmbedding = typeof documentEmbedding.$inferSelect;
export type NewDocumentEmbedding = typeof documentEmbedding.$inferInsert;
