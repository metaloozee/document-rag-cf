import { chatConversation } from "./chat-conversation";
import { chatMessage } from "./chat-message";
import { documentChunk } from "./document-chunk";
import { documentEmbedding } from "./document-embedding";
import { project } from "./project";
import { projectDocument } from "./project-document";
import { userSettings } from "./user-settings";

export const appSchema = {
  chatConversation,
  chatMessage,
  documentChunk,
  documentEmbedding,
  project,
  projectDocument,
  userSettings,
};
