import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, or, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  parkingSchema,
  createParkingInputSchema,
  updateParkingInputSchema,
  parkingStatusSchema,
  isoDateSchema,
} from '@momentum/shared';
import { parkings } from '@momentum/db';
import { db } from '../db.ts';
import { mapParking } from '../mappers.ts';
import { notFound } from '../errors.ts';
import { recordInboxEvent } from '../services/events.ts';

export const parkingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /**
   * Returns team-visible parkings plus the current user's own private ones.
   * Other users' private parkings are never returned — they also can't be
   * found by id, so /parkings/:id probes against a private parking they
   * don't own return 404.
   */
  app.get(
    '/parkings',
    {
      schema: {
        querystring: z.object({
          status: parkingStatusSchema.optional(),
          targetDate: isoDateSchema.optional(),
          roleId: z.string().uuid().optional(),
        }),
        response: { 200: z.array(parkingSchema) },
      },
    },
    async (req) => {
      const visibleConds = or(
        eq(parkings.visibility, 'team'),
        and(
          eq(parkings.visibility, 'private'),
          eq(parkings.creatorId, req.userId),
        ),
      );
      const conds = [visibleConds];
      if (req.query.status) conds.push(eq(parkings.status, req.query.status));
      if (req.query.targetDate) conds.push(eq(parkings.targetDate, req.query.targetDate));
      if (req.query.roleId) conds.push(eq(parkings.roleId, req.query.roleId));

      const rows = await db
        .select()
        .from(parkings)
        .where(and(...conds))
        .orderBy(asc(parkings.targetDate), desc(parkings.createdAt));
      return rows.map(mapParking);
    },
  );

  app.post(
    '/parkings',
    {
      schema: {
        body: createParkingInputSchema,
        response: { 200: parkingSchema },
      },
    },
    async (req) => {
      const body = req.body;
      const involvedIds = body.involvedIds ?? [];
      const [row] = await db
        .insert(parkings)
        .values({
          creatorId: req.userId,
          title: body.title,
          notes: body.notes ?? null,
          outcome: body.outcome ?? null,
          targetDate: body.targetDate ?? null,
          roleId: body.roleId ?? null,
          priority: body.priority ?? 'medium',
          visibility: body.visibility ?? 'team',
          involvedIds,
        })
        .returning();
      if (!row) throw new Error('Failed to create parking');

      // Notify every involved user except the creator (self-suppression
      // is enforced in recordInboxEvent too, but skipping here avoids a
      // no-op call).
      for (const userId of dedupe(involvedIds)) {
        if (userId === req.userId) continue;
        await recordInboxEvent({
          userId,
          actorId: req.userId,
          eventType: 'parking_involvement',
          entityType: 'parking',
          entityId: row.id,
          payload: { title: row.title },
        });
      }

      return mapParking(row);
    },
  );

  app.patch(
    '/parkings/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateParkingInputSchema,
        response: { 200: parkingSchema },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(parkings)
        .where(eq(parkings.id, req.params.id))
        .limit(1);
      if (!existing) throw notFound('Parking not found');

      // Private parkings: only the creator can edit. Return 404 (not 403)
      // to avoid leaking existence to non-creators.
      if (existing.visibility === 'private' && existing.creatorId !== req.userId) {
        throw notFound('Parking not found');
      }

      const [row] = await db
        .update(parkings)
        .set(req.body)
        .where(eq(parkings.id, req.params.id))
        .returning();
      if (!row) throw notFound('Parking not found');

      // Inbox events for newly-added involved users only.
      if (req.body.involvedIds !== undefined) {
        const before = new Set(existing.involvedIds);
        const added = dedupe(req.body.involvedIds).filter((id) => !before.has(id));
        for (const userId of added) {
          if (userId === req.userId) continue;
          await recordInboxEvent({
            userId,
            actorId: req.userId,
            eventType: 'parking_involvement',
            entityType: 'parking',
            entityId: row.id,
            payload: { title: row.title },
          });
        }
      }

      return mapParking(row);
    },
  );

  app.delete(
    '/parkings/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [existing] = await db
        .select({
          visibility: parkings.visibility,
          creatorId: parkings.creatorId,
        })
        .from(parkings)
        .where(eq(parkings.id, req.params.id))
        .limit(1);
      if (!existing) throw notFound('Parking not found');

      if (existing.visibility === 'private' && existing.creatorId !== req.userId) {
        throw notFound('Parking not found');
      }

      const [row] = await db
        .delete(parkings)
        .where(eq(parkings.id, req.params.id))
        .returning({ id: parkings.id });
      if (!row) throw notFound('Parking not found');
      return { ok: true as const };
    },
  );

  app.post(
    '/parkings/:id/discuss',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: parkingSchema },
      },
    },
    async (req) => {
      // Flat perms: any authenticated user can mark a team parking discussed.
      // Private parkings are only visible to the creator anyway, so the
      // caller either is the creator or sees 404.
      const [existing] = await db
        .select({
          visibility: parkings.visibility,
          creatorId: parkings.creatorId,
        })
        .from(parkings)
        .where(eq(parkings.id, req.params.id))
        .limit(1);
      if (!existing) throw notFound('Parking not found');
      if (existing.visibility === 'private' && existing.creatorId !== req.userId) {
        throw notFound('Parking not found');
      }

      const [row] = await db
        .update(parkings)
        .set({
          status: 'discussed',
          discussedAt: sql`COALESCE(${parkings.discussedAt}, NOW())`,
        })
        .where(eq(parkings.id, req.params.id))
        .returning();
      if (!row) throw notFound('Parking not found');
      return mapParking(row);
    },
  );

  app.post(
    '/parkings/:id/reopen',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: parkingSchema },
      },
    },
    async (req) => {
      const [existing] = await db
        .select({
          visibility: parkings.visibility,
          creatorId: parkings.creatorId,
        })
        .from(parkings)
        .where(eq(parkings.id, req.params.id))
        .limit(1);
      if (!existing) throw notFound('Parking not found');
      if (existing.visibility === 'private' && existing.creatorId !== req.userId) {
        throw notFound('Parking not found');
      }

      const [row] = await db
        .update(parkings)
        .set({ status: 'open', discussedAt: null })
        .where(eq(parkings.id, req.params.id))
        .returning();
      if (!row) throw notFound('Parking not found');
      return mapParking(row);
    },
  );
};

function dedupe(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}
