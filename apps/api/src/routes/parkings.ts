import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
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

export const parkingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

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
      const conds = [eq(parkings.userId, req.userId)];
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
      const [row] = await db
        .insert(parkings)
        .values({
          userId: req.userId,
          title: body.title,
          notes: body.notes ?? null,
          outcome: body.outcome ?? null,
          targetDate: body.targetDate ?? null,
          roleId: body.roleId ?? null,
          priority: body.priority ?? 'medium',
        })
        .returning();
      if (!row) throw new Error('Failed to create parking');
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
      const [row] = await db
        .update(parkings)
        .set(req.body)
        .where(and(eq(parkings.id, req.params.id), eq(parkings.userId, req.userId)))
        .returning();
      if (!row) throw notFound('Parking not found');
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
      const [row] = await db
        .delete(parkings)
        .where(and(eq(parkings.id, req.params.id), eq(parkings.userId, req.userId)))
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
      const [row] = await db
        .update(parkings)
        .set({
          status: 'discussed',
          discussedAt: sql`COALESCE(${parkings.discussedAt}, NOW())`,
        })
        .where(and(eq(parkings.id, req.params.id), eq(parkings.userId, req.userId)))
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
      const [row] = await db
        .update(parkings)
        .set({ status: 'open', discussedAt: null })
        .where(and(eq(parkings.id, req.params.id), eq(parkings.userId, req.userId)))
        .returning();
      if (!row) throw notFound('Parking not found');
      return mapParking(row);
    },
  );
};
