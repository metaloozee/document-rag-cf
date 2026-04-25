import { TRPCError } from "@trpc/server";
import type { UIMessage } from "ai";
import { generateId, validateUIMessages } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { fallbackConversationTitle } from "@/lib/chat/fallback-conversation-title";
import type { db } from "@/lib/db";
import { chatConversation, chatMessage } from "@/lib/db/schema";
import { getOwnedProject } from "@/lib/documents/ingestion";

import { createTRPCRouter, protectedProcedure } from "../init";

type DbInstance = typeof db;

interface ProtectedChatContext {
  db: DbInstance;
  session: { user: { id: string } };
}

const CHAT_ID_LENGTH = 16;
const MAX_FIRST_MESSAGE_CHARS = 50_000;
const MAX_SYNCED_MESSAGES = 500;

const chatIdSchema = z.string().length(CHAT_ID_LENGTH);
const projectIdSchema = z.string().min(1);
const conversationTitleSchema = z.string().trim().max(200).optional();

const messagesInputSchema = z.unknown();

const assertOwnedProject = async ({
  ctx,
  projectId,
}: {
  ctx: ProtectedChatContext;
  projectId: string;
}) => {
  const ownerUserId = ctx.session.user.id;
  const found = await getOwnedProject({ ownerUserId, projectId });

  if (!found) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  return found;
};

const getOwnedConversation = async ({
  ctx,
  conversationId,
  projectId,
}: {
  ctx: ProtectedChatContext;
  conversationId: string;
  projectId: string;
}) => {
  const ownerUserId = ctx.session.user.id;

  const [row] = await ctx.db
    .select()
    .from(chatConversation)
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.projectId, projectId),
        eq(chatConversation.ownerUserId, ownerUserId)
      )
    )
    .limit(1);

  return row ?? null;
};

const rowToUiMessage = (row: typeof chatMessage.$inferSelect): UIMessage => ({
  id: row.id,
  metadata: row.metadata ?? undefined,
  parts: row.parts as UIMessage["parts"],
  role: row.role as UIMessage["role"],
});

const listOwnedConversationMessages = async ({
  ctx,
  conversationId,
  projectId,
}: {
  ctx: ProtectedChatContext;
  conversationId: string;
  projectId: string;
}): Promise<UIMessage[]> => {
  const rows = await ctx.db
    .select()
    .from(chatMessage)
    .where(
      and(
        eq(chatMessage.conversationId, conversationId),
        eq(chatMessage.projectId, projectId),
        eq(chatMessage.ownerUserId, ctx.session.user.id)
      )
    )
    .orderBy(asc(chatMessage.sequence));

  return rows.map(rowToUiMessage);
};

export const chatRouter = createTRPCRouter({
  createConversation: protectedProcedure
    .input(
      z.object({
        id: chatIdSchema,
        projectId: projectIdSchema,
        title: conversationTitleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });
      const ownerUserId = ctx.session.user.id;

      try {
        const [created] = await ctx.db
          .insert(chatConversation)
          .values({
            id: input.id,
            ownerUserId,
            projectId: input.projectId,
            title: input.title ?? null,
          })
          .returning();

        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create conversation",
          });
        }

        return created;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "23505"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A conversation with this id already exists",
          });
        }

        throw error;
      }
    }),

  deleteConversation: protectedProcedure
    .input(
      z.object({
        conversationId: chatIdSchema,
        projectId: projectIdSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });
      const ownerUserId = ctx.session.user.id;

      const [deleted] = await ctx.db
        .delete(chatConversation)
        .where(
          and(
            eq(chatConversation.id, input.conversationId),
            eq(chatConversation.projectId, input.projectId),
            eq(chatConversation.ownerUserId, ownerUserId)
          )
        )
        .returning({ id: chatConversation.id });

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return deleted;
    }),

  getConversationById: protectedProcedure
    .input(
      z.object({
        conversationId: chatIdSchema,
        projectId: projectIdSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });

      const conversation = await getOwnedConversation({
        conversationId: input.conversationId,
        ctx,
        projectId: input.projectId,
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return conversation;
    }),

  getConversationMessages: protectedProcedure
    .input(
      z.object({
        conversationId: chatIdSchema,
        projectId: projectIdSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });

      const conversation = await getOwnedConversation({
        conversationId: input.conversationId,
        ctx,
        projectId: input.projectId,
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return listOwnedConversationMessages({
        conversationId: input.conversationId,
        ctx,
        projectId: input.projectId,
      });
    }),

  getConversationThread: protectedProcedure
    .input(
      z.object({
        conversationId: chatIdSchema,
        projectId: projectIdSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });

      const conversation = await getOwnedConversation({
        conversationId: input.conversationId,
        ctx,
        projectId: input.projectId,
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return {
        conversation,
        messages: await listOwnedConversationMessages({
          conversationId: input.conversationId,
          ctx,
          projectId: input.projectId,
        }),
      };
    }),

  listProjectConversations: protectedProcedure
    .input(
      z.object({
        projectId: projectIdSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });
      const ownerUserId = ctx.session.user.id;

      return ctx.db
        .select()
        .from(chatConversation)
        .where(
          and(
            eq(chatConversation.projectId, input.projectId),
            eq(chatConversation.ownerUserId, ownerUserId)
          )
        )
        .orderBy(desc(chatConversation.updatedAt));
    }),

  startNewConversationWithFirstMessage: protectedProcedure
    .input(
      z.object({
        projectId: projectIdSchema,
        text: z.string().trim().min(1).max(MAX_FIRST_MESSAGE_CHARS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });
      const ownerUserId = ctx.session.user.id;
      const chatId = generateId();
      const messageId = generateId();
      const plainText = input.text.trim();
      const title = fallbackConversationTitle(plainText);

      const userMessage: UIMessage = {
        id: messageId,
        parts: [{ text: plainText, type: "text" }],
        role: "user",
      };

      await validateUIMessages({ messages: [userMessage] });

      await ctx.db.transaction(async (tx) => {
        await tx.insert(chatConversation).values({
          id: chatId,
          ownerUserId,
          projectId: input.projectId,
          title,
        });

        await tx.insert(chatMessage).values({
          conversationId: chatId,
          id: messageId,
          metadata: null,
          ownerUserId,
          parts: userMessage.parts as unknown[],
          projectId: input.projectId,
          role: "user",
          sequence: 0,
        });
      });

      return { chatId } as const;
    }),

  syncConversationMessages: protectedProcedure
    .input(
      z.object({
        conversationId: chatIdSchema,
        messages: messagesInputSchema,
        projectId: projectIdSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });
      const ownerUserId = ctx.session.user.id;

      const conversation = await getOwnedConversation({
        conversationId: input.conversationId,
        ctx,
        projectId: input.projectId,
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      let messages: UIMessage[];

      try {
        messages = await validateUIMessages({
          messages: input.messages,
        });
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid chat messages payload",
        });
      }

      if (messages.length > MAX_SYNCED_MESSAGES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `At most ${MAX_SYNCED_MESSAGES} messages can be stored per sync`,
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(chatMessage)
          .where(
            and(
              eq(chatMessage.conversationId, input.conversationId),
              eq(chatMessage.ownerUserId, ownerUserId),
              eq(chatMessage.projectId, input.projectId)
            )
          );

        if (messages.length > 0) {
          await tx.insert(chatMessage).values(
            messages.map((message, sequence) => ({
              conversationId: input.conversationId,
              id: message.id,
              metadata:
                message.metadata === undefined
                  ? null
                  : (message.metadata as Record<string, unknown>),
              ownerUserId,
              parts: message.parts as unknown[],
              projectId: input.projectId,
              role: message.role,
              sequence,
            }))
          );
        }

        await tx
          .update(chatConversation)
          .set({ updatedAt: new Date() })
          .where(
            and(
              eq(chatConversation.id, input.conversationId),
              eq(chatConversation.projectId, input.projectId),
              eq(chatConversation.ownerUserId, ownerUserId)
            )
          );
      });

      return { ok: true as const, savedCount: messages.length };
    }),

  updateConversationTitle: protectedProcedure
    .input(
      z.object({
        conversationId: chatIdSchema,
        projectId: projectIdSchema,
        title: z.string().trim().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedProject({ ctx, projectId: input.projectId });
      const ownerUserId = ctx.session.user.id;

      const [updated] = await ctx.db
        .update(chatConversation)
        .set({ title: input.title })
        .where(
          and(
            eq(chatConversation.id, input.conversationId),
            eq(chatConversation.projectId, input.projectId),
            eq(chatConversation.ownerUserId, ownerUserId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return updated;
    }),
});
