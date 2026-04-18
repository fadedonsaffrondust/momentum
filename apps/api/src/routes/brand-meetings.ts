import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  brandMeetingSchema,
  createBrandMeetingInputSchema,
  updateBrandMeetingInputSchema,
} from '@momentum/shared';
import { brandMeetings, brands } from '@momentum/db';
import { db } from '../db.ts';
import { mapBrandMeeting } from '../mappers.ts';
import { notFound } from '../errors.ts';
import { resolveAttendeeUserIds } from '../lib/attendees.ts';
import { recordBrandEvent } from '../services/events.ts';

const brandIdParam = z.object({ brandId: z.string().uuid() });
const idParam = z.object({ brandId: z.string().uuid(), id: z.string().uuid() });

export const brandMeetingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/brands/:brandId/meetings',
    {
      schema: {
        params: brandIdParam,
        response: { 200: z.array(brandMeetingSchema) },
      },
    },
    async (req) => {
      const rows = await db
        .select()
        .from(brandMeetings)
        .where(eq(brandMeetings.brandId, req.params.brandId))
        .orderBy(desc(brandMeetings.date));
      return rows.map(mapBrandMeeting);
    },
  );

  app.post(
    '/brands/:brandId/meetings',
    {
      schema: {
        params: brandIdParam,
        body: createBrandMeetingInputSchema,
        response: { 200: brandMeetingSchema },
      },
    },
    async (req) => {
      const attendees = req.body.attendees ?? [];
      const attendeeUserIds = await resolveAttendeeUserIds(attendees);

      const [row] = await db
        .insert(brandMeetings)
        .values({
          brandId: req.params.brandId,
          date: req.body.date,
          title: req.body.title,
          attendees,
          attendeeUserIds,
          summary: req.body.summary ?? null,
          rawNotes: req.body.rawNotes,
          decisions: req.body.decisions ?? [],
        })
        .returning();
      if (!row) throw new Error('Failed to create meeting');

      await db
        .update(brands)
        .set({ updatedAt: new Date() })
        .where(eq(brands.id, req.params.brandId));

      await recordBrandEvent({
        brandId: req.params.brandId,
        actorId: req.userId,
        eventType: 'meeting_added',
        entityType: 'brand_meeting',
        entityId: row.id,
        payload: { title: row.title, date: row.date },
      });

      return mapBrandMeeting(row);
    },
  );

  app.patch(
    '/brands/:brandId/meetings/:id',
    {
      schema: {
        params: idParam,
        body: updateBrandMeetingInputSchema,
        response: { 200: brandMeetingSchema },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(brandMeetings)
        .where(
          and(
            eq(brandMeetings.id, req.params.id),
            eq(brandMeetings.brandId, req.params.brandId),
          ),
        )
        .limit(1);
      if (!existing) throw notFound('Meeting not found');

      const updates: Record<string, unknown> = { ...req.body };
      // Recompute attendeeUserIds when attendees[] changes.
      if (req.body.attendees !== undefined) {
        updates.attendeeUserIds = await resolveAttendeeUserIds(req.body.attendees);
      }

      const [row] = await db
        .update(brandMeetings)
        .set(updates)
        .where(
          and(
            eq(brandMeetings.id, req.params.id),
            eq(brandMeetings.brandId, req.params.brandId),
          ),
        )
        .returning();
      if (!row) throw notFound('Meeting not found');

      await recordBrandEvent({
        brandId: req.params.brandId,
        actorId: req.userId,
        eventType: 'meeting_edited',
        entityType: 'brand_meeting',
        entityId: row.id,
        payload: { changedFields: Object.keys(req.body), title: row.title },
      });

      return mapBrandMeeting(row);
    },
  );

  app.delete(
    '/brands/:brandId/meetings/:id',
    {
      schema: {
        params: idParam,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [existing] = await db
        .select({ id: brandMeetings.id, title: brandMeetings.title, date: brandMeetings.date })
        .from(brandMeetings)
        .where(
          and(
            eq(brandMeetings.id, req.params.id),
            eq(brandMeetings.brandId, req.params.brandId),
          ),
        )
        .limit(1);
      if (!existing) throw notFound('Meeting not found');

      // Event goes first — brand_events.entity_id is not FK-constrained to
      // the meeting table, so the value is preserved after the delete.
      // Recording it before the delete matches the pattern used by the
      // other team-shared sub-entities (spec §3: events are mutable, not
      // immutable audit logs, so lifecycle ordering is cosmetic here).
      await recordBrandEvent({
        brandId: req.params.brandId,
        actorId: req.userId,
        eventType: 'meeting_deleted',
        entityType: 'brand_meeting',
        entityId: existing.id,
        payload: { title: existing.title, date: existing.date },
      });

      const [row] = await db
        .delete(brandMeetings)
        .where(
          and(
            eq(brandMeetings.id, req.params.id),
            eq(brandMeetings.brandId, req.params.brandId),
          ),
        )
        .returning({ id: brandMeetings.id });
      if (!row) throw notFound('Meeting not found');

      return { ok: true as const };
    },
  );
};
