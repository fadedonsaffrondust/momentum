import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { brandSchema, createBrandInputSchema, updateBrandInputSchema } from '@momentum/shared';
import { brands } from '@momentum/db';
import { db } from '../db.ts';
import { mapBrand } from '../mappers.ts';
import { notFound } from '../errors.ts';

export const brandsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/brands',
    { schema: { response: { 200: z.array(brandSchema) } } },
    async (req) => {
      const rows = await db
        .select()
        .from(brands)
        .where(eq(brands.userId, req.userId))
        .orderBy(desc(brands.updatedAt));
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
          userId: req.userId,
          name: req.body.name,
          goals: req.body.goals ?? null,
          successDefinition: req.body.successDefinition ?? null,
        })
        .returning();
      if (!row) throw new Error('Failed to create brand');
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
        .where(and(eq(brands.id, req.params.id), eq(brands.userId, req.userId)))
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
        .where(and(eq(brands.id, req.params.id), eq(brands.userId, req.userId)))
        .returning();
      if (!row) throw notFound('Brand not found');
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
      const [row] = await db
        .delete(brands)
        .where(and(eq(brands.id, req.params.id), eq(brands.userId, req.userId)))
        .returning({ id: brands.id });
      if (!row) throw notFound('Brand not found');
      return { ok: true as const };
    },
  );
};
