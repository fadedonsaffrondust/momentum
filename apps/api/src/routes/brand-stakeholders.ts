import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import {
  brandStakeholderSchema,
  createBrandStakeholderInputSchema,
  updateBrandStakeholderInputSchema,
} from '@momentum/shared';
import { brandStakeholders, brands } from '@momentum/db';
import { db } from '../db.ts';
import { mapBrandStakeholder } from '../mappers.ts';
import { notFound } from '../errors.ts';

const brandIdParam = z.object({ brandId: z.string().uuid() });
const idParam = z.object({ brandId: z.string().uuid(), id: z.string().uuid() });

export const brandStakeholdersRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/brands/:brandId/stakeholders',
    {
      schema: {
        params: brandIdParam,
        response: { 200: z.array(brandStakeholderSchema) },
      },
    },
    async (req) => {
      const rows = await db
        .select()
        .from(brandStakeholders)
        .where(
          and(
            eq(brandStakeholders.brandId, req.params.brandId),
            eq(brandStakeholders.userId, req.userId),
          ),
        )
        .orderBy(asc(brandStakeholders.createdAt));
      return rows.map(mapBrandStakeholder);
    },
  );

  app.post(
    '/brands/:brandId/stakeholders',
    {
      schema: {
        params: brandIdParam,
        body: createBrandStakeholderInputSchema,
        response: { 200: brandStakeholderSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .insert(brandStakeholders)
        .values({
          brandId: req.params.brandId,
          userId: req.userId,
          name: req.body.name,
          role: req.body.role ?? null,
          notes: req.body.notes ?? null,
        })
        .returning();
      if (!row) throw new Error('Failed to create stakeholder');
      await db
        .update(brands)
        .set({ updatedAt: new Date() })
        .where(eq(brands.id, req.params.brandId));
      return mapBrandStakeholder(row);
    },
  );

  app.patch(
    '/brands/:brandId/stakeholders/:id',
    {
      schema: {
        params: idParam,
        body: updateBrandStakeholderInputSchema,
        response: { 200: brandStakeholderSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .update(brandStakeholders)
        .set(req.body)
        .where(
          and(
            eq(brandStakeholders.id, req.params.id),
            eq(brandStakeholders.brandId, req.params.brandId),
            eq(brandStakeholders.userId, req.userId),
          ),
        )
        .returning();
      if (!row) throw notFound('Stakeholder not found');
      return mapBrandStakeholder(row);
    },
  );

  app.delete(
    '/brands/:brandId/stakeholders/:id',
    {
      schema: {
        params: idParam,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [row] = await db
        .delete(brandStakeholders)
        .where(
          and(
            eq(brandStakeholders.id, req.params.id),
            eq(brandStakeholders.brandId, req.params.brandId),
            eq(brandStakeholders.userId, req.userId),
          ),
        )
        .returning({ id: brandStakeholders.id });
      if (!row) throw notFound('Stakeholder not found');
      return { ok: true as const };
    },
  );
};
