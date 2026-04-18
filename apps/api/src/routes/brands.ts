import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { brandSchema, createBrandInputSchema, updateBrandInputSchema } from '@momentum/shared';
import { brands } from '@momentum/db';
import { db } from '../db.ts';
import { mapBrand } from '../mappers.ts';
import { notFound } from '../errors.ts';
import { recordBrandEvent } from '../services/events.ts';

export const brandsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/brands',
    { schema: { response: { 200: z.array(brandSchema) } } },
    async () => {
      const rows = await db.select().from(brands).orderBy(desc(brands.updatedAt));
      return rows.map(mapBrand);
    },
  );

  app.post(
    '/brands',
    {
      schema: {
        body: createBrandInputSchema,
        response: { 200: brandSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .insert(brands)
        .values({
          name: req.body.name,
          goals: req.body.goals ?? null,
          successDefinition: req.body.successDefinition ?? null,
        })
        .returning();
      if (!row) throw new Error('Failed to create brand');

      await recordBrandEvent({
        brandId: row.id,
        actorId: req.userId,
        eventType: 'brand_edited',
        entityType: 'brand',
        entityId: row.id,
        payload: { action: 'created', name: row.name },
      });

      return mapBrand(row);
    },
  );

  app.get(
    '/brands/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: brandSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .select()
        .from(brands)
        .where(eq(brands.id, req.params.id))
        .limit(1);
      if (!row) throw notFound('Brand not found');
      return mapBrand(row);
    },
  );

  app.patch(
    '/brands/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateBrandInputSchema,
        response: { 200: brandSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .update(brands)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(brands.id, req.params.id))
        .returning();
      if (!row) throw notFound('Brand not found');

      await recordBrandEvent({
        brandId: row.id,
        actorId: req.userId,
        eventType: 'brand_edited',
        entityType: 'brand',
        entityId: row.id,
        payload: {
          action: 'updated',
          changedFields: Object.keys(req.body),
        },
      });

      return mapBrand(row);
    },
  );

  app.delete(
    '/brands/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [existing] = await db
        .select({ id: brands.id, name: brands.name })
        .from(brands)
        .where(eq(brands.id, req.params.id))
        .limit(1);
      if (!existing) throw notFound('Brand not found');

      // Record the event BEFORE the delete — the brand_events row has an
      // FK to brands with ON DELETE CASCADE, so the event will be wiped
      // when the brand is removed. Inserting afterwards would violate the
      // FK. The event is ephemeral here by design (spec §3 non-goal:
      // "no audit log / immutable event history").
      await recordBrandEvent({
        brandId: existing.id,
        actorId: req.userId,
        eventType: 'brand_edited',
        entityType: 'brand',
        entityId: existing.id,
        payload: { action: 'deleted', name: existing.name },
      });

      const [row] = await db
        .delete(brands)
        .where(eq(brands.id, req.params.id))
        .returning({ id: brands.id });
      if (!row) throw notFound('Brand not found');

      return { ok: true as const };
    },
  );
};
