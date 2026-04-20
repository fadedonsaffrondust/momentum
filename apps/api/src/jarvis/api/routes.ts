import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  jarvisCreateConversationInputSchema,
  jarvisCreateConversationResponseSchema,
  jarvisConversationSummarySchema,
  jarvisConversationDetailSchema,
  jarvisListConversationsQuerySchema,
  jarvisPostMessageInputSchema,
} from '@momentum/shared';
import { db } from '../../db.ts';
import { notFound } from '../../errors.ts';
import {
  createConversation,
  listConversationsByUser,
  getConversationForUser,
  archiveConversation,
} from '../persistence/conversations.ts';
import { listAllMessagesByConversation } from '../persistence/messages.ts';
import { getJarvisService } from '../service.ts';
import { endSse, startSseKeepAlive, writeSseEvent, writeSseHeaders } from './streaming.ts';

/**
 * Routes mounted at `/api/jarvis`. Four pure-DB endpoints (create, list,
 * get, delete) plus one SSE-streaming endpoint for posting a message and
 * receiving the assistant's turn live.
 *
 * Every route is authenticated; conversations are strictly owner-private
 * per the guardrails, so every read/write goes through
 * `getConversationForUser` first (returns null on ownership mismatch,
 * which translates to a 404 via `notFound()` — indistinguishable from
 * "not found" so we don't leak existence of other users' threads).
 */

const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/** Generate a short title from the first user message. LLM-summarized titles are TODO. */
export function titleFromMessage(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 60).trimEnd() + '…';
}

export const jarvisRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /* ─── POST /api/jarvis/conversations — create ─── */
  app.post(
    '/api/jarvis/conversations',
    {
      schema: {
        body: jarvisCreateConversationInputSchema,
        response: { 200: jarvisCreateConversationResponseSchema },
      },
    },
    async (req) => {
      const title = req.body.initialMessage
        ? titleFromMessage(req.body.initialMessage)
        : 'New conversation';
      const row = await createConversation(db, { userId: req.userId, title });
      return { conversationId: row.id, title: row.title };
    },
  );

  /* ─── GET /api/jarvis/conversations — list ─── */
  app.get(
    '/api/jarvis/conversations',
    {
      schema: {
        querystring: jarvisListConversationsQuerySchema,
        response: { 200: z.array(jarvisConversationSummarySchema) },
      },
    },
    async (req) => {
      const rows = await listConversationsByUser(db, req.userId, {
        limit: req.query.limit,
        offset: req.query.offset,
        includeArchived: req.query.includeArchived,
      });
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      }));
    },
  );

  /* ─── GET /api/jarvis/conversations/:id — full detail ─── */
  app.get(
    '/api/jarvis/conversations/:id',
    {
      schema: {
        params: conversationIdParamsSchema,
        response: { 200: jarvisConversationDetailSchema },
      },
    },
    async (req) => {
      const conv = await getConversationForUser(db, req.params.id, req.userId);
      if (!conv) throw notFound('Conversation not found');
      const messages = await listAllMessagesByConversation(db, conv.id);
      return {
        conversation: {
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString(),
          archivedAt: conv.archivedAt ? conv.archivedAt.toISOString() : null,
          metadata: conv.metadata,
        },
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          intent: m.intent,
          model: m.model,
          latencyMs: m.latencyMs,
          tokenUsage: m.tokenUsage,
          error: m.error,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    },
  );

  /* ─── DELETE /api/jarvis/conversations/:id — soft archive ─── */
  app.delete(
    '/api/jarvis/conversations/:id',
    {
      schema: {
        params: conversationIdParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (req, reply) => {
      const conv = await getConversationForUser(db, req.params.id, req.userId);
      if (!conv) throw notFound('Conversation not found');
      await archiveConversation(db, conv.id);
      reply.code(204);
      return null;
    },
  );

  /* ─── POST /api/jarvis/conversations/:id/messages — SSE stream ─── */
  app.post(
    '/api/jarvis/conversations/:id/messages',
    {
      schema: {
        params: conversationIdParamsSchema,
        body: jarvisPostMessageInputSchema,
      },
    },
    async (req, reply) => {
      const conv = await getConversationForUser(db, req.params.id, req.userId);
      if (!conv) throw notFound('Conversation not found');

      const service = getJarvisService();

      writeSseHeaders(reply.raw);
      reply.hijack();
      const stopKeepAlive = startSseKeepAlive(reply.raw);

      try {
        await service.streamMessage(
          {
            conversationId: conv.id,
            userId: req.userId,
            userMessage: req.body.content,
            logger: req.log,
          },
          (event) => writeSseEvent(reply.raw, event),
        );
      } catch (err) {
        // `streamMessage` already emitted an `error` event via onEvent
        // before throwing; we just log here and close the stream in the
        // finally block. Don't re-throw — we already hijacked the reply,
        // so Fastify can't do anything with the error.
        req.log.error({ err }, 'jarvis: streamMessage threw after error event was emitted');
      } finally {
        stopKeepAlive();
        endSse(reply.raw);
      }
    },
  );
};
