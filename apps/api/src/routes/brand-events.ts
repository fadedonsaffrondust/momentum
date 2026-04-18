import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { brandEventSchema, type BrandEvent, type BrandEventType } from '@momentum/shared';
import { brandEvents, users } from '@momentum/db';
import { db } from '../db.ts';
import { mapUserSummary } from '../mappers.ts';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const brandEventsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /**
   * Per-brand activity timeline. Reverse-chronological, cursor-paged.
   * Actor is hydrated inline so the client can render avatars without a
   * second round-trip. Events are team-visible (no ownership check —
   * brands themselves are team-shared in team space).
   */
  app.get(
    '/brands/:brandId/events',
    {
      schema: {
        params: z.object({ brandId: z.string().uuid() }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
          cursor: z.string().datetime().optional(),
        }),
        response: { 200: z.array(brandEventSchema) },
      },
    },
    async (req) => {
      const limit = req.query.limit ?? DEFAULT_LIMIT;

      const conds = [eq(brandEvents.brandId, req.params.brandId)];
      if (req.query.cursor) {
        conds.push(lt(brandEvents.createdAt, new Date(req.query.cursor)));
      }

      const rows = await db
        .select({ event: brandEvents, actor: users })
        .from(brandEvents)
        .innerJoin(users, eq(brandEvents.actorId, users.id))
        .where(and(...conds))
        .orderBy(desc(brandEvents.createdAt))
        .limit(limit);

      const out: BrandEvent[] = rows.map((r) => ({
        id: r.event.id,
        brandId: r.event.brandId,
        actor: mapUserSummary(r.actor),
        eventType: r.event.eventType as BrandEventType,
        entityType: r.event.entityType,
        entityId: r.event.entityId,
        payload: (r.event.payload ?? {}) as Record<string, unknown>,
        createdAt: r.event.createdAt.toISOString(),
      }));

      return out;
    },
  );
};
