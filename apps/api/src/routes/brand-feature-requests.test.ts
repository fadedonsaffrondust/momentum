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

vi.mock('../db.ts', () => ({ db: mockDb, client: {} }));

import { authPlugin } from '../plugins/auth.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { brandFeatureRequestsRoutes } from './brand-feature-requests.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const BRAND_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const FR_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-04-16T12:00:00Z');

function makeFeatureRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: FR_ID,
    brandId: BRAND_ID,
    sheetRowIndex: null,
    date: '2026/04/14',
    request: 'Add car dealership industry',
    response: null,
    resolved: false,
    syncStatus: 'pending',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('brand feature requests routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(brandFeatureRequestsRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
  });

  // ── GET /brands/:brandId/feature-requests ─────────────────────────

  it('GET returns a list of feature requests', async () => {
    const row = makeFeatureRequestRow();
    mockDb._pushResult([row]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/feature-requests`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(FR_ID);
    expect(body[0].request).toBe('Add car dealership industry');
  });

  it('GET returns empty array when no results', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/feature-requests`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('GET supports resolved filter', async () => {
    mockDb._pushResult([makeFeatureRequestRow({ resolved: true })]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/feature-requests?resolved=true`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].resolved).toBe(true);
  });

  it('GET supports search query', async () => {
    mockDb._pushResult([makeFeatureRequestRow()]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/feature-requests?search=dealership`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });

  it('GET requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/feature-requests`,
    });

    expect(res.statusCode).toBe(401);
  });

  // ── POST /brands/:brandId/feature-requests ────────────────────────

  it('POST creates a feature request', async () => {
    const row = makeFeatureRequestRow();
    mockDb._pushResult([row]); // insert returning
    mockDb._pushResult([{ id: BRAND_ID }]); // brands update

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/feature-requests`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        date: '2026/04/14',
        request: 'Add car dealership industry',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.request).toBe('Add car dealership industry');
    expect(body.syncStatus).toBe('pending');
  });

  it('POST creates with optional fields', async () => {
    const row = makeFeatureRequestRow({
      response: 'Working on it',
      resolved: true,
    });
    mockDb._pushResult([row]);
    mockDb._pushResult([{ id: BRAND_ID }]);

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/feature-requests`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        date: '2026/04/14',
        request: 'Add car dealership industry',
        response: 'Working on it',
        resolved: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.response).toBe('Working on it');
    expect(body.resolved).toBe(true);
  });

  it('POST rejects empty request text', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/feature-requests`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        date: '2026/04/14',
        request: '',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // ── PATCH /brands/:brandId/feature-requests/:id ───────────────────

  it('PATCH updates a feature request', async () => {
    const existing = makeFeatureRequestRow();
    const updatedRow = makeFeatureRequestRow({ response: 'Done!', syncStatus: 'pending' });
    mockDb._pushResult([existing]); // select existing
    mockDb._pushResult([updatedRow]); // update returning

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/feature-requests/${FR_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { response: 'Done!' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.response).toBe('Done!');
    expect(body.syncStatus).toBe('pending');
  });

  it('PATCH toggles resolved', async () => {
    const existing = makeFeatureRequestRow({ resolved: false });
    const updatedRow = makeFeatureRequestRow({ resolved: true });
    mockDb._pushResult([existing]);
    mockDb._pushResult([updatedRow]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/feature-requests/${FR_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { resolved: true },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).resolved).toBe(true);
  });

  it('PATCH returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/feature-requests/${FR_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { response: 'test' },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── DELETE /brands/:brandId/feature-requests/:id ──────────────────

  it('DELETE removes a feature request', async () => {
    mockDb._pushResult([makeFeatureRequestRow()]); // select existing

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}/feature-requests/${FR_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('DELETE returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}/feature-requests/${FR_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── POST /brands/:brandId/feature-requests/:id/convert-to-action ──

  it('POST convert-to-action creates action item and marks resolved', async () => {
    const frRow = makeFeatureRequestRow();
    const actionItemRow = {
      id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      brandId: BRAND_ID,
      meetingId: null,
      creatorId: USER_ID,
      assigneeId: null,
      text: frRow.request,
      status: 'open',
      owner: null,
      dueDate: null,
      linkedTaskId: null,
      createdAt: NOW,
      completedAt: null,
    };
    const updatedFr = makeFeatureRequestRow({ resolved: true, syncStatus: 'pending' });

    mockDb._pushResult([frRow]); // select existing
    mockDb._pushResult([actionItemRow]); // insert action item
    mockDb._pushResult([updatedFr]); // update feature request

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/feature-requests/${FR_ID}/convert-to-action`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.featureRequest.resolved).toBe(true);
    expect(body.actionItem.text).toBe(frRow.request);
    expect(body.actionItem.creatorId).toBe(USER_ID);
    expect(body.actionItem.assigneeId).toBeNull();
  });

  it('POST convert-to-action returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/feature-requests/${FR_ID}/convert-to-action`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
