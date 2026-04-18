import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and, desc, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  brandFeatureRequestSchema,
  createBrandFeatureRequestInputSchema,
  updateBrandFeatureRequestInputSchema,
  convertFeatureRequestResponseSchema,
  type FeatureRequestsConfig,
} from '@momentum/shared';
import { brandFeatureRequests, brandActionItems, brands } from '@momentum/db';
import { db } from '../db.ts';
import { mapBrandFeatureRequest, mapBrandActionItem } from '../mappers.ts';
import { notFound } from '../errors.ts';
import { env } from '../env.ts';
import { GoogleSheetsClient } from '../services/google-sheets.ts';
import type { InferSelectModel } from 'drizzle-orm';

type DbFeatureRequest = InferSelectModel<typeof brandFeatureRequests>;

async function pushRowToSheet(row: DbFeatureRequest, brandId: string): Promise<void> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) return;
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  const config = brand?.featureRequestsConfig as FeatureRequestsConfig | null;
  if (!config?.connected) return;

  try {
    const client = new GoogleSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const values = client.formatRow(
      { date: row.date, request: row.request, response: row.response, resolved: row.resolved },
      config.columnMapping,
    );

    if (row.sheetRowIndex !== null) {
      await client.writeRow(config.sheetId, config.sheetGid, row.sheetRowIndex, values);
    } else {
      const newIndex = await client.appendRow(config.sheetId, config.sheetGid, values);
      await db.update(brandFeatureRequests).set({ sheetRowIndex: newIndex }).where(eq(brandFeatureRequests.id, row.id));
    }

    await db.update(brandFeatureRequests).set({ syncStatus: 'synced' }).where(eq(brandFeatureRequests.id, row.id));
  } catch {
    await db.update(brandFeatureRequests).set({ syncStatus: 'error' }).where(eq(brandFeatureRequests.id, row.id));
  }
}

async function deleteRowFromSheet(sheetRowIndex: number, brandId: string): Promise<void> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) return;
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  const config = brand?.featureRequestsConfig as FeatureRequestsConfig | null;
  if (!config?.connected) return;

  try {
    const client = new GoogleSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    await client.clearRow(config.sheetId, config.sheetGid, sheetRowIndex);
  } catch {
    // Best-effort
  }
}

const brandIdParam = z.object({ brandId: z.string().uuid() });
const idParam = z.object({ brandId: z.string().uuid(), id: z.string().uuid() });

export const brandFeatureRequestsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/brands/:brandId/feature-requests',
    {
      schema: {
        params: brandIdParam,
        querystring: z.object({
          resolved: z.enum(['true', 'false']).optional(),
          search: z.string().optional(),
        }),
        response: { 200: z.array(brandFeatureRequestSchema) },
      },
    },
    async (req) => {
      const conds = [
        eq(brandFeatureRequests.brandId, req.params.brandId),
        eq(brandFeatureRequests.userId, req.userId),
      ];
      if (req.query.resolved !== undefined) {
        conds.push(eq(brandFeatureRequests.resolved, req.query.resolved === 'true'));
      }
      if (req.query.search) {
        const pattern = `%${req.query.search}%`;
        conds.push(
          or(
            ilike(brandFeatureRequests.request, pattern),
            ilike(brandFeatureRequests.response, pattern),
          )!,
        );
      }
      const rows = await db
        .select()
        .from(brandFeatureRequests)
        .where(and(...conds))
        .orderBy(desc(brandFeatureRequests.date), desc(brandFeatureRequests.createdAt));
      return rows.map(mapBrandFeatureRequest);
    },
  );

  app.post(
    '/brands/:brandId/feature-requests',
    {
      schema: {
        params: brandIdParam,
        body: createBrandFeatureRequestInputSchema,
        response: { 200: brandFeatureRequestSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .insert(brandFeatureRequests)
        .values({
          brandId: req.params.brandId,
          userId: req.userId,
          date: req.body.date,
          request: req.body.request,
          response: req.body.response ?? null,
          resolved: req.body.resolved ?? false,
          syncStatus: 'pending',
        })
        .returning();
      if (!row) throw new Error('Failed to create feature request');
      await db
        .update(brands)
        .set({ updatedAt: new Date() })
        .where(eq(brands.id, req.params.brandId));
      pushRowToSheet(row, req.params.brandId).catch(() => {});
      return mapBrandFeatureRequest(row);
    },
  );

  app.patch(
    '/brands/:brandId/feature-requests/:id',
    {
      schema: {
        params: idParam,
        body: updateBrandFeatureRequestInputSchema,
        response: { 200: brandFeatureRequestSchema },
      },
    },
    async (req) => {
      const [row] = await db
        .update(brandFeatureRequests)
        .set({
          ...req.body,
          syncStatus: 'pending',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(brandFeatureRequests.id, req.params.id),
            eq(brandFeatureRequests.brandId, req.params.brandId),
            eq(brandFeatureRequests.userId, req.userId),
          ),
        )
        .returning();
      if (!row) throw notFound('Feature request not found');
      pushRowToSheet(row, req.params.brandId).catch(() => {});
      return mapBrandFeatureRequest(row);
    },
  );

  app.delete(
    '/brands/:brandId/feature-requests/:id',
    {
      schema: {
        params: idParam,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(brandFeatureRequests)
        .where(
          and(
            eq(brandFeatureRequests.id, req.params.id),
            eq(brandFeatureRequests.brandId, req.params.brandId),
            eq(brandFeatureRequests.userId, req.userId),
          ),
        )
        .limit(1);
      if (!existing) throw notFound('Feature request not found');

      await db
        .delete(brandFeatureRequests)
        .where(eq(brandFeatureRequests.id, existing.id));

      if (existing.sheetRowIndex !== null) {
        deleteRowFromSheet(existing.sheetRowIndex, req.params.brandId).catch(() => {});
      }
      return { ok: true as const };
    },
  );

  app.post(
    '/brands/:brandId/feature-requests/:id/convert-to-action',
    {
      schema: {
        params: idParam,
        response: { 200: convertFeatureRequestResponseSchema },
      },
    },
    async (req) => {
      const [existing] = await db
        .select()
        .from(brandFeatureRequests)
        .where(
          and(
            eq(brandFeatureRequests.id, req.params.id),
            eq(brandFeatureRequests.brandId, req.params.brandId),
            eq(brandFeatureRequests.userId, req.userId),
          ),
        )
        .limit(1);
      if (!existing) throw notFound('Feature request not found');

      const [actionItem] = await db
        .insert(brandActionItems)
        .values({
          brandId: req.params.brandId,
          userId: req.userId,
          text: existing.request,
        })
        .returning();
      if (!actionItem) throw new Error('Failed to create action item');

      const [updated] = await db
        .update(brandFeatureRequests)
        .set({ resolved: true, syncStatus: 'pending', updatedAt: new Date() })
        .where(eq(brandFeatureRequests.id, existing.id))
        .returning();
      if (!updated) throw new Error('Failed to update feature request');

      return {
        featureRequest: mapBrandFeatureRequest(updated),
        actionItem: mapBrandActionItem(actionItem),
      };
    },
  );
};
