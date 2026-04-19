import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  inboxEventSchema,
  type InboxEntitySummary,
  type InboxEvent,
  type InboxEventType,
} from '@momentum/shared';
import { inboxEvents, users, tasks, parkings, brandActionItems, brands } from '@momentum/db';
import { db } from '../db.ts';
import { mapUserSummary } from '../mappers.ts';
import { notFound } from '../errors.ts';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Build the hydrated `entity` summary for each inbox event by loading
 * the referenced rows in bulk (one query per entity type). Unknown or
 * deleted entities surface as `null` — the inbox row still renders,
 * just without a clickable entity preview.
 */
async function hydrateEntities(
  rows: Array<{ entityType: string; entityId: string }>,
): Promise<Map<string, InboxEntitySummary>> {
  const byType = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byType.get(r.entityType) ?? new Set();
    set.add(r.entityId);
    byType.set(r.entityType, set);
  }

  const out = new Map<string, InboxEntitySummary>();

  // Tasks: title only.
  const taskIds = [...(byType.get('task') ?? [])];
  if (taskIds.length > 0) {
    const taskRows = await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(inArray(tasks.id, taskIds));
    for (const t of taskRows) {
      out.set(`task:${t.id}`, { id: t.id, title: t.title });
    }
  }

  // Parkings: title only.
  const parkingIds = [...(byType.get('parking') ?? [])];
  if (parkingIds.length > 0) {
    const parkingRows = await db
      .select({ id: parkings.id, title: parkings.title })
      .from(parkings)
      .where(inArray(parkings.id, parkingIds));
    for (const p of parkingRows) {
      out.set(`parking:${p.id}`, { id: p.id, title: p.title });
    }
  }

  // Brand action items: title = text, plus brandId + brandName for linking.
  const actionItemIds = [...(byType.get('brand_action_item') ?? [])];
  if (actionItemIds.length > 0) {
    const itemRows = await db
      .select({
        id: brandActionItems.id,
        text: brandActionItems.text,
        brandId: brandActionItems.brandId,
        brandName: brands.name,
      })
      .from(brandActionItems)
      .leftJoin(brands, eq(brandActionItems.brandId, brands.id))
      .where(inArray(brandActionItems.id, actionItemIds));
    for (const r of itemRows) {
      out.set(`brand_action_item:${r.id}`, {
        id: r.id,
        title: r.text,
        brandId: r.brandId,
        ...(r.brandName ? { brandName: r.brandName } : {}),
      });
    }
  }

  return out;
}

export const inboxRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/inbox',
    {
      schema: {
        querystring: z.object({
          unreadOnly: z.enum(['true', 'false']).optional(),
          limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
          cursor: z.string().datetime().optional(),
        }),
        response: { 200: z.array(inboxEventSchema) },
      },
    },
    async (req) => {
      const limit = req.query.limit ?? DEFAULT_LIMIT;
      const unreadOnly = req.query.unreadOnly === 'true';

      const conds = [eq(inboxEvents.userId, req.userId)];
      if (unreadOnly) conds.push(isNull(inboxEvents.readAt));
      if (req.query.cursor) {
        conds.push(lt(inboxEvents.createdAt, new Date(req.query.cursor)));
      }

      const rows = await db
        .select({
          event: inboxEvents,
          actor: users,
        })
        .from(inboxEvents)
        .innerJoin(users, eq(inboxEvents.actorId, users.id))
        .where(and(...conds))
        .orderBy(desc(inboxEvents.createdAt))
        .limit(limit);

      const entityMap = await hydrateEntities(
        rows.map((r) => ({ entityType: r.event.entityType, entityId: r.event.entityId })),
      );

      const out: InboxEvent[] = rows.map((r) => {
        const entityKey = `${r.event.entityType}:${r.event.entityId}`;
        return {
          id: r.event.id,
          userId: r.event.userId,
          actor: mapUserSummary(r.actor),
          eventType: r.event.eventType as InboxEventType,
          entityType: r.event.entityType,
          entityId: r.event.entityId,
          payload: (r.event.payload ?? {}) as Record<string, unknown>,
          entity: entityMap.get(entityKey) ?? null,
          readAt: r.event.readAt ? r.event.readAt.toISOString() : null,
          createdAt: r.event.createdAt.toISOString(),
        };
      });

      return out;
    },
  );

  app.get(
    '/inbox/unread-count',
    {
      schema: { response: { 200: z.object({ count: z.number().int().nonnegative() }) } },
    },
    async (req) => {
      const [row] = (await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(inboxEvents)
        .where(and(eq(inboxEvents.userId, req.userId), isNull(inboxEvents.readAt)))) as [
        { count: number },
      ];

      return { count: row?.count ?? 0 };
    },
  );

  app.post(
    '/inbox/:id/read',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [row] = await db
        .update(inboxEvents)
        .set({ readAt: new Date() })
        .where(and(eq(inboxEvents.id, req.params.id), eq(inboxEvents.userId, req.userId)))
        .returning({ id: inboxEvents.id });
      if (!row) throw notFound('Inbox event not found');
      return { ok: true as const };
    },
  );

  app.post(
    '/inbox/read-all',
    {
      schema: {
        response: { 200: z.object({ updated: z.number().int().nonnegative() }) },
      },
    },
    async (req) => {
      const rows = await db
        .update(inboxEvents)
        .set({ readAt: new Date() })
        .where(and(eq(inboxEvents.userId, req.userId), isNull(inboxEvents.readAt)))
        .returning({ id: inboxEvents.id });

      return { updated: rows.length };
    },
  );
};
