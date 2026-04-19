import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

const { mockDb } = vi.hoisted(() => {
  const results: unknown[] = [];
  function createChain(): any {
    const chain: any = new Proxy(() => {}, {
      get(_target: any, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            const result = results.shift();
            if (result instanceof Error) reject(result);
            else resolve(result);
          };
        }
        return (..._args: unknown[]) => chain;
      },
      apply() {
        return chain;
      },
    });
    return chain;
  }
  const mockDb = {
    select: vi.fn((..._args: unknown[]) => createChain()),
    insert: vi.fn((..._args: unknown[]) => createChain()),
    update: vi.fn((..._args: unknown[]) => createChain()),
    delete: vi.fn((..._args: unknown[]) => createChain()),
    _results: results,
    _pushResult(value: unknown) {
      results.push(value);
    },
    _pushResults(...values: unknown[]) {
      results.push(...values);
    },
  };
  return { mockDb };
});

const mockReadSheet = vi.fn();
const mockRewriteHeaders = vi.fn();
const mockParseRows = vi.fn();
const mockWriteRow = vi.fn();
const mockWriteAllRows = vi.fn();
const mockAppendRow = vi.fn();
const mockFormatRow = vi.fn();
const mockStandardizeSheetFormatting = vi.fn();

vi.mock('../db.ts', () => ({ db: mockDb, client: {} }));

vi.mock('../env.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../env.ts')>();
  return {
    env: {
      ...actual.env,
      GOOGLE_SERVICE_ACCOUNT_KEY: '{"type":"service_account","project_id":"test"}',
    },
  };
});

vi.mock('../services/google-sheets.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/google-sheets.ts')>();
  return {
    ...actual,
    GoogleSheetsClient: vi.fn().mockImplementation(() => ({
      readSheet: mockReadSheet,
      rewriteHeaders: mockRewriteHeaders,
      parseRows: mockParseRows,
      writeRow: mockWriteRow,
      writeAllRows: mockWriteAllRows,
      appendRow: mockAppendRow,
      formatRow: mockFormatRow,
      standardizeSheetFormatting: mockStandardizeSheetFormatting,
    })),
  };
});

import { authPlugin } from '../plugins/auth.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { brandFeatureRequestSyncRoutes } from './brand-feature-request-sync.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const BRAND_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const FR_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-04-16T12:00:00Z');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1abc123/edit#gid=0';

function makeBrandRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BRAND_ID,
    userId: USER_ID,
    name: 'Test Brand',
    featureRequestsConfig: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeFrRow(overrides: Record<string, unknown> = {}) {
  return {
    id: FR_ID,
    brandId: BRAND_ID,
    userId: USER_ID,
    sheetRowIndex: 1,
    date: '2026/04/14',
    request: 'Add car dealership industry',
    response: null,
    resolved: false,
    syncStatus: 'synced',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('brand feature request sync routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(brandFeatureRequestSyncRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
    vi.clearAllMocks();
  });

  // ── connect-sheet ─────────────────────────────────────────────────

  describe('POST /brands/:brandId/feature-requests/connect-sheet', () => {
    it('connects a sheet and imports rows', async () => {
      mockReadSheet.mockResolvedValue([
        ['Date', 'Request', 'Response', 'Resolved'],
        ['2026/04/14', 'Add car dealership', '', 'FALSE'],
      ]);
      mockRewriteHeaders.mockResolvedValue(undefined);
      mockParseRows.mockReturnValue([
        {
          rowIndex: 1,
          date: '2026/04/14',
          request: 'Add car dealership',
          response: '',
          resolved: false,
        },
      ]);

      // update brands returning
      mockDb._pushResult([makeBrandRow()]);
      // insert feature request (no returning needed, but chain resolves)
      mockDb._pushResult(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/connect-sheet`,
        headers: { authorization: `Bearer ${token}` },
        payload: { sheetUrl: SHEET_URL, standardize: true },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.imported).toBe(1);
      expect(body.config.connected).toBe(true);
      expect(body.config.sheetId).toBe('1abc123');
      expect(body.headers.original).toEqual(['Date', 'Request', 'Response', 'Resolved']);
    });

    it('rejects invalid sheet URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/connect-sheet`,
        headers: { authorization: `Bearer ${token}` },
        payload: { sheetUrl: 'https://google.com', standardize: true },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects unrecognizable columns', async () => {
      mockReadSheet.mockResolvedValue([['Col A', 'Col B', 'Col C']]);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/connect-sheet`,
        headers: { authorization: `Bearer ${token}` },
        payload: { sheetUrl: SHEET_URL, standardize: true },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toMatch(/column structure/i);
    });
  });

  // ── sync/pull ─────────────────────────────────────────────────────

  describe('POST /brands/:brandId/feature-requests/sync/pull', () => {
    const connectedConfig = {
      sheetId: '1abc123',
      sheetGid: '0',
      sheetUrl: SHEET_URL,
      connected: true,
      lastSyncedAt: NOW.toISOString(),
      columnMapping: { date: 0, request: 1, response: 2, resolved: 3 },
    };

    it('pulls new rows from the sheet', async () => {
      // select brand
      mockDb._pushResult([makeBrandRow({ featureRequestsConfig: connectedConfig })]);
      // select existing feature requests
      mockDb._pushResult([]);

      mockReadSheet.mockResolvedValue([
        ['Date', 'Request', 'Response', 'Resolved'],
        ['2026/04/14', 'New feature', '', 'FALSE'],
      ]);
      mockParseRows.mockReturnValue([
        { rowIndex: 1, date: '2026/04/14', request: 'New feature', response: '', resolved: false },
      ]);

      // insert new row
      mockDb._pushResult(undefined);
      // update brand lastSyncedAt
      mockDb._pushResult(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/sync/pull`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.created).toBe(1);
      expect(body.updated).toBe(0);
      expect(body.unchanged).toBe(0);
    });

    it('updates changed rows', async () => {
      mockDb._pushResult([makeBrandRow({ featureRequestsConfig: connectedConfig })]);
      mockDb._pushResult([makeFrRow()]);

      mockReadSheet.mockResolvedValue([
        ['Date', 'Request', 'Response', 'Resolved'],
        ['2026/04/14', 'Updated request', 'Some response', 'FALSE'],
      ]);
      mockParseRows.mockReturnValue([
        {
          rowIndex: 1,
          date: '2026/04/14',
          request: 'Updated request',
          response: 'Some response',
          resolved: false,
        },
      ]);

      // update row
      mockDb._pushResult(undefined);
      // update brand
      mockDb._pushResult(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/sync/pull`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.updated).toBe(1);
      expect(body.created).toBe(0);
    });

    it('detects deleted rows from the sheet', async () => {
      mockDb._pushResult([makeBrandRow({ featureRequestsConfig: connectedConfig })]);
      mockDb._pushResult([makeFrRow({ sheetRowIndex: 5 })]);

      mockReadSheet.mockResolvedValue([['Date', 'Request', 'Response', 'Resolved']]);
      mockParseRows.mockReturnValue([]);

      // update deleted row (null sheetRowIndex)
      mockDb._pushResult(undefined);
      // update brand
      mockDb._pushResult(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/sync/pull`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).deleted).toBe(1);
    });

    it('fails when no sheet is connected', async () => {
      mockDb._pushResult([makeBrandRow({ featureRequestsConfig: null })]);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/sync/pull`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── sync/push ─────────────────────────────────────────────────────

  describe('POST /brands/:brandId/feature-requests/sync/push', () => {
    const connectedConfig = {
      sheetId: '1abc123',
      sheetGid: '0',
      sheetUrl: SHEET_URL,
      connected: true,
      lastSyncedAt: NOW.toISOString(),
      columnMapping: { date: 0, request: 1, response: 2, resolved: 3 },
    };

    it('pushes pending rows to the sheet', async () => {
      mockDb._pushResult([makeBrandRow({ featureRequestsConfig: connectedConfig })]);
      mockDb._pushResult([makeFrRow({ syncStatus: 'pending', sheetRowIndex: 1 })]);

      mockFormatRow.mockReturnValue(['2026/04/14', 'Add car dealership', '', 'FALSE']);
      mockWriteRow.mockResolvedValue(undefined);

      // update syncStatus
      mockDb._pushResult(undefined);
      // update brand lastSyncedAt
      mockDb._pushResult(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/sync/push`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.pushed).toBe(1);
      expect(body.errors).toEqual([]);
      expect(mockWriteRow).toHaveBeenCalled();
    });

    it('appends new rows without sheetRowIndex', async () => {
      mockDb._pushResult([makeBrandRow({ featureRequestsConfig: connectedConfig })]);
      mockDb._pushResult([makeFrRow({ syncStatus: 'pending', sheetRowIndex: null })]);

      mockFormatRow.mockReturnValue(['2026/04/14', 'Add car dealership', '', 'FALSE']);
      mockAppendRow.mockResolvedValue(5);

      // update sheetRowIndex
      mockDb._pushResult(undefined);
      // update syncStatus
      mockDb._pushResult(undefined);
      // update brand
      mockDb._pushResult(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/sync/push`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).pushed).toBe(1);
      expect(mockAppendRow).toHaveBeenCalled();
    });

    it('handles write errors gracefully', async () => {
      mockDb._pushResult([makeBrandRow({ featureRequestsConfig: connectedConfig })]);
      mockDb._pushResult([makeFrRow({ syncStatus: 'pending', sheetRowIndex: 1 })]);

      mockFormatRow.mockReturnValue(['2026/04/14', 'Add car dealership', '', 'FALSE']);
      mockWriteRow.mockRejectedValue(new Error('Permission denied'));

      // update syncStatus to error
      mockDb._pushResult(undefined);
      // update brand
      mockDb._pushResult(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/sync/push`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.pushed).toBe(0);
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0]).toMatch(/Permission denied/);
    });
  });

  // ── disconnect-sheet ──────────────────────────────────────────────

  describe('POST /brands/:brandId/feature-requests/disconnect-sheet', () => {
    it('disconnects the sheet and nulls sheetRowIndex', async () => {
      // update brand
      mockDb._pushResult([makeBrandRow()]);
      // update feature requests
      mockDb._pushResult(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/disconnect-sheet`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true });
    });

    it('returns 404 for unknown brand', async () => {
      mockDb._pushResult([]);

      const res = await app.inject({
        method: 'POST',
        url: `/brands/${BRAND_ID}/feature-requests/disconnect-sheet`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
