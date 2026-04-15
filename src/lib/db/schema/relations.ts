import { relations } from "drizzle-orm";

import { account, session, user } from "./auth";
import { chatConversation } from "./chat-conversation";
import { chatMessage } from "./chat-message";
import { documentChunk } from "./document-chunk";
import { documentEmbedding } from "./document-embedding";
import { project } from "./project";
import { projectDocument } from "./project-document";
import { userSettings } from "./user-settings";

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  chatConversations: many(chatConversation),
  chatMessages: many(chatMessage),
  documentChunks: many(documentChunk),
  documentEmbeddings: many(documentEmbedding),
  projectDocuments: many(projectDocument),
  projects: many(project),
  sessions: many(session),
  settings: one(userSettings),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const projectRelations = relations(project, ({ many, one }) => ({
  chatConversations: many(chatConversation),
  chatMessages: many(chatMessage),
  documentChunks: many(documentChunk),
  documentEmbeddings: many(documentEmbedding),
  documents: many(projectDocument),
  owner: one(user, {
    fields: [project.ownerUserId],
    references: [user.id],
  }),
}));

export const chatConversationRelations = relations(
  chatConversation,
  ({ many, one }) => ({
    messages: many(chatMessage),
    owner: one(user, {
      fields: [chatConversation.ownerUserId],
      references: [user.id],
    }),
    project: one(project, {
      fields: [chatConversation.projectId],
      references: [project.id],
    }),
  })
);

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  conversation: one(chatConversation, {
    fields: [chatMessage.conversationId],
    references: [chatConversation.id],
  }),
  owner: one(user, {
    fields: [chatMessage.ownerUserId],
    references: [user.id],
  }),
  project: one(project, {
    fields: [chatMessage.projectId],
    references: [project.id],
  }),
}));

export const projectDocumentRelations = relations(
  projectDocument,
  ({ many, one }) => ({
    chunks: many(documentChunk),
    embeddings: many(documentEmbedding),
    owner: one(user, {
      fields: [projectDocument.ownerUserId],
      references: [user.id],
    }),
    project: one(project, {
      fields: [projectDocument.projectId],
      references: [project.id],
    }),
  })
);

export const documentChunkRelations = relations(documentChunk, ({ one }) => ({
  document: one(projectDocument, {
    fields: [documentChunk.documentId],
    references: [projectDocument.id],
  }),
  embedding: one(documentEmbedding, {
    fields: [documentChunk.id],
    references: [documentEmbedding.chunkId],
  }),
  owner: one(user, {
    fields: [documentChunk.ownerUserId],
    references: [user.id],
  }),
  project: one(project, {
    fields: [documentChunk.projectId],
    references: [project.id],
  }),
}));

export const documentEmbeddingRelations = relations(
  documentEmbedding,
  ({ one }) => ({
    chunk: one(documentChunk, {
      fields: [documentEmbedding.chunkId],
      references: [documentChunk.id],
    }),
    document: one(projectDocument, {
      fields: [documentEmbedding.documentId],
      references: [projectDocument.id],
    }),
    owner: one(user, {
      fields: [documentEmbedding.ownerUserId],
      references: [user.id],
    }),
    project: one(project, {
      fields: [documentEmbedding.projectId],
      references: [project.id],
    }),
  })
);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}));
