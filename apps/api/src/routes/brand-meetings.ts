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
        .where(
          and(
            eq(brandMeetings.brandId, req.params.brandId),
            eq(brandMeetings.userId, req.userId),
          ),
        )
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
      const [row] = await db
        .insert(brandMeetings)
        .values({
          brandId: req.params.brandId,
          userId: req.userId,
          date: req.body.date,
          title: req.body.title,
          attendees: req.body.attendees ?? [],
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
      const [row] = await db
        .update(brandMeetings)
        .set(req.body)
        .where(
          and(
            eq(brandMeetings.id, req.params.id),
            eq(brandMeetings.brandId, req.params.brandId),
            eq(brandMeetings.userId, req.userId),
          ),
        )
        .returning();
      if (!row) throw notFound('Meeting not found');
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
      const [row] = await db
        .delete(brandMeetings)
        .where(
          and(
            eq(brandMeetings.id, req.params.id),
            eq(brandMeetings.brandId, req.params.brandId),
            eq(brandMeetings.userId, req.userId),
          ),
        )
        .returning({ id: brandMeetings.id });
      if (!row) throw notFound('Meeting not found');
      return { ok: true as const };
    },
  );
};
