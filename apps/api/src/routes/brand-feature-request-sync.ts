import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import {
  connectSheetInputSchema,
  connectSheetResponseSchema,
  sheetSyncPullResponseSchema,
  sheetSyncPushResponseSchema,
  type FeatureRequestsConfig,
} from '@momentum/shared';
import { brands, brandFeatureRequests } from '@momentum/db';
import { db } from '../db.ts';
import { mapBrandFeatureRequest } from '../mappers.ts';
import { notFound, badRequest } from '../errors.ts';
import { env } from '../env.ts';
import {
  GoogleSheetsClient,
  parseSheetUrl,
  analyzeColumns,
} from '../services/google-sheets.ts';

const brandIdParam = z.object({ brandId: z.string().uuid() });
const CANONICAL_HEADERS = ['Date', 'Request', 'Response', 'Resolved'];

function getSheetsClient(): GoogleSheetsClient {
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw badRequest('Google Sheets integration is not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY.');
  }
  return new GoogleSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_KEY);
}

function getConfig(raw: unknown): FeatureRequestsConfig {
  const config = raw as FeatureRequestsConfig | null;
  if (!config?.connected) {
    throw badRequest('No Google Sheet connected for this brand.');
  }
  return config;
}

export const brandFeatureRequestSyncRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  // Connect a Google Sheet to this brand's feature requests
  app.post(
    '/brands/:brandId/feature-requests/connect-sheet',
    {
      schema: {
        params: brandIdParam,
        body: connectSheetInputSchema,
        response: { 200: connectSheetResponseSchema },
      },
    },
    async (req) => {
      const client = getSheetsClient();
      const parsed = parseSheetUrl(req.body.sheetUrl);
      if (!parsed) {
        throw badRequest('Invalid Google Sheets URL.');
      }

      const gid = req.body.sheetGid ?? parsed.gid;
      const rawRows = await client.readSheet(parsed.spreadsheetId, gid);
      const headerRow = rawRows[0] ?? [];

      const mapping = analyzeColumns(headerRow);
      if (!mapping) {
        throw badRequest(
          'Could not detect column structure. Expected columns matching: Date, Request, Response, Resolved.',
        );
      }

      // Parse rows using the ORIGINAL mapping (before any header rewrite)
      const sheetRows = client.parseRows(rawRows, mapping);

      if (req.body.standardize) {
        await client.rewriteHeaders(parsed.spreadsheetId, gid, CANONICAL_HEADERS);
        const rowsToWrite = sheetRows.map((row) => ({
          rowIndex: row.rowIndex,
          values: [row.date, row.request, row.response, row.resolved ? 'TRUE' : 'FALSE'],
        }));
        await client.writeAllRows(parsed.spreadsheetId, gid, rowsToWrite);
        await client.standardizeSheetFormatting(parsed.spreadsheetId, gid, sheetRows.length);
      }

      const config: FeatureRequestsConfig = {
        sheetId: parsed.spreadsheetId,
        sheetGid: gid,
        sheetUrl: req.body.sheetUrl,
        connected: true,
        lastSyncedAt: new Date().toISOString(),
        columnMapping: req.body.standardize
          ? { date: 0, request: 1, response: 2, resolved: 3 }
          : mapping,
      };

      const [brand] = await db
        .update(brands)
        .set({
          featureRequestsConfig: config,
          updatedAt: new Date(),
        })
        .where(
          eq(brands.id, req.params.brandId),
        )
        .returning();
      if (!brand) throw notFound('Brand not found');

      let imported = 0;
      for (const row of sheetRows) {
        await db.insert(brandFeatureRequests).values({
          brandId: req.params.brandId,
          sheetRowIndex: row.rowIndex,
          date: row.date,
          request: row.request,
          response: row.response || null,
          resolved: row.resolved,
          syncStatus: 'synced',
        });
        imported++;
      }

      return {
        config,
        imported,
        headers: {
          original: headerRow,
          mapped: CANONICAL_HEADERS,
        },
      };
    },
  );

  // Pull changes from Google Sheet into Momentum
  app.post(
    '/brands/:brandId/feature-requests/sync/pull',
    {
      schema: {
        params: brandIdParam,
        response: { 200: sheetSyncPullResponseSchema },
      },
    },
    async (req) => {
      const client = getSheetsClient();

      const [brand] = await db
        .select()
        .from(brands)
        .where(eq(brands.id, req.params.brandId))
        .limit(1);
      if (!brand) throw notFound('Brand not found');

      const config = getConfig(brand.featureRequestsConfig);
      const rawRows = await client.readSheet(config.sheetId, config.sheetGid);
      const sheetRows = client.parseRows(rawRows, config.columnMapping);

      const dbRows = await db
        .select()
        .from(brandFeatureRequests)
        .where(eq(brandFeatureRequests.brandId, req.params.brandId));

      const dbByRowIndex = new Map(
        dbRows.filter((r) => r.sheetRowIndex !== null).map((r) => [r.sheetRowIndex!, r]),
      );
      const sheetRowIndexSet = new Set(sheetRows.map((r) => r.rowIndex));

      let created = 0;
      let updated = 0;
      let deleted = 0;
      let unchanged = 0;
      const errors: string[] = [];

      for (const sheetRow of sheetRows) {
        const existing = dbByRowIndex.get(sheetRow.rowIndex);
        if (existing) {
          const changed =
            existing.date !== sheetRow.date ||
            existing.request !== sheetRow.request ||
            (existing.response ?? '') !== sheetRow.response ||
            existing.resolved !== sheetRow.resolved;

          if (changed) {
            await db
              .update(brandFeatureRequests)
              .set({
                date: sheetRow.date,
                request: sheetRow.request,
                response: sheetRow.response || null,
                resolved: sheetRow.resolved,
                syncStatus: 'synced',
                updatedAt: new Date(),
              })
              .where(eq(brandFeatureRequests.id, existing.id));
            updated++;
          } else {
            unchanged++;
          }
        } else {
          await db.insert(brandFeatureRequests).values({
            brandId: req.params.brandId,
            sheetRowIndex: sheetRow.rowIndex,
            date: sheetRow.date,
            request: sheetRow.request,
            response: sheetRow.response || null,
            resolved: sheetRow.resolved,
            syncStatus: 'synced',
          });
          created++;
        }
      }

      for (const [rowIdx, dbRow] of dbByRowIndex) {
        if (!sheetRowIndexSet.has(rowIdx)) {
          await db
            .update(brandFeatureRequests)
            .set({ sheetRowIndex: null, syncStatus: 'pending', updatedAt: new Date() })
            .where(eq(brandFeatureRequests.id, dbRow.id));
          deleted++;
        }
      }

      await db
        .update(brands)
        .set({
          featureRequestsConfig: {
            ...config,
            lastSyncedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(brands.id, req.params.brandId));

      return { created, updated, deleted, unchanged, errors };
    },
  );

  // Push pending changes from Momentum to Google Sheet
  app.post(
    '/brands/:brandId/feature-requests/sync/push',
    {
      schema: {
        params: brandIdParam,
        response: { 200: sheetSyncPushResponseSchema },
      },
    },
    async (req) => {
      const client = getSheetsClient();

      const [brand] = await db
        .select()
        .from(brands)
        .where(eq(brands.id, req.params.brandId))
        .limit(1);
      if (!brand) throw notFound('Brand not found');

      const config = getConfig(brand.featureRequestsConfig);

      const pendingRows = await db
        .select()
        .from(brandFeatureRequests)
        .where(
          and(
            eq(brandFeatureRequests.brandId, req.params.brandId),
            eq(brandFeatureRequests.syncStatus, 'pending'),
          ),
        );

      let pushed = 0;
      const errors: string[] = [];

      for (const row of pendingRows) {
        try {
          const values = client.formatRow(
            {
              date: row.date,
              request: row.request,
              response: row.response,
              resolved: row.resolved,
            },
            config.columnMapping,
          );

          if (row.sheetRowIndex !== null) {
            await client.writeRow(config.sheetId, config.sheetGid, row.sheetRowIndex, values);
          } else {
            const newRowIndex = await client.appendRow(config.sheetId, config.sheetGid, values);
            await db
              .update(brandFeatureRequests)
              .set({ sheetRowIndex: newRowIndex })
              .where(eq(brandFeatureRequests.id, row.id));
          }

          await db
            .update(brandFeatureRequests)
            .set({ syncStatus: 'synced', updatedAt: new Date() })
            .where(eq(brandFeatureRequests.id, row.id));
          pushed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Row ${row.id}: ${msg}`);
          await db
            .update(brandFeatureRequests)
            .set({ syncStatus: 'error', updatedAt: new Date() })
            .where(eq(brandFeatureRequests.id, row.id));
        }
      }

      await db
        .update(brands)
        .set({
          featureRequestsConfig: {
            ...config,
            lastSyncedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(brands.id, req.params.brandId));

      return { pushed, errors };
    },
  );

  // Disconnect the Google Sheet from this brand
  app.post(
    '/brands/:brandId/feature-requests/disconnect-sheet',
    {
      schema: {
        params: brandIdParam,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const [brand] = await db
        .update(brands)
        .set({
          featureRequestsConfig: null,
          updatedAt: new Date(),
        })
        .where(eq(brands.id, req.params.brandId))
        .returning();
      if (!brand) throw notFound('Brand not found');

      await db
        .update(brandFeatureRequests)
        .set({ sheetRowIndex: null, syncStatus: 'pending', updatedAt: new Date() })
        .where(eq(brandFeatureRequests.brandId, req.params.brandId));

      return { ok: true as const };
    },
  );
};
