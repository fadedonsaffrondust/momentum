import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

const { mockDb, mockRecordBrandEvent } = vi.hoisted(() => {
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
      apply() { return chain; },
    });
    return chain;
  }
  const mockDb = {
    select: vi.fn((..._args: unknown[]) => createChain()),
    insert: vi.fn((..._args: unknown[]) => createChain()),
    update: vi.fn((..._args: unknown[]) => createChain()),
    delete: vi.fn((..._args: unknown[]) => createChain()),
    _results: results,
    _pushResult(value: unknown) { results.push(value); },
    _pushResults(...values: unknown[]) { results.push(...values); },
  };
  const mockRecordBrandEvent = vi.fn(async (..._args: unknown[]) => undefined);
  return { mockDb, mockRecordBrandEvent };
});

vi.mock('../db.ts', () => ({ db: mockDb, client: {} }));
vi.mock('../services/events.ts', () => ({
  recordBrandEvent: mockRecordBrandEvent,
  recordInboxEvent: vi.fn(async () => undefined),
}));

import { authPlugin } from '../plugins/auth.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { brandsRoutes } from './brands.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const BRAND_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-04-17T12:00:00Z');

function makeBrandRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BRAND_ID,
    name: 'Acme Corp',
    goals: null,
    successDefinition: null,
    customFields: {},
    syncConfig: null,
    featureRequestsConfig: null,
    status: 'active',
    importError: null,
    importedFrom: null,
    rawImportContent: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('brands routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(brandsRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
    mockRecordBrandEvent.mockClear();
  });

  it('GET /brands returns the team-shared brand list', async () => {
    mockDb._pushResult([makeBrandRow(), makeBrandRow({ id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Boudin' })]);

    const res = await app.inject({
      method: 'GET',
      url: '/brands',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(2);
  });

  it('GET /brands/:id returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /brands creates + emits brand_edited with action=created', async () => {
    mockDb._pushResult([makeBrandRow({ name: 'Cowboy Chicken' })]);

    const res = await app.inject({
      method: 'POST',
      url: '/brands',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Cowboy Chicken' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      brandId: BRAND_ID,
      actorId: USER_ID,
      eventType: 'brand_edited',
      entityType: 'brand',
      entityId: BRAND_ID,
      payload: expect.objectContaining({ action: 'created', name: 'Cowboy Chicken' }),
    });
  });

  it('PATCH /brands/:id emits brand_edited with changedFields', async () => {
    mockDb._pushResult([makeBrandRow({ goals: 'Increase retention' })]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { goals: 'Increase retention', successDefinition: 'Churn < 5%' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'brand_edited',
      payload: expect.objectContaining({
        action: 'updated',
        changedFields: ['goals', 'successDefinition'],
      }),
    });
  });

  it('PATCH /brands/:id returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X' },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
  });

  it('DELETE /brands/:id emits brand_edited with action=deleted BEFORE removing the brand', async () => {
    mockDb._pushResult([{ id: BRAND_ID, name: 'Cowboy Chicken' }]); // select existing
    mockDb._pushResult([{ id: BRAND_ID }]); // delete returning

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'brand_edited',
      payload: expect.objectContaining({ action: 'deleted', name: 'Cowboy Chicken' }),
    });
    // Ordering: event recorded before delete (matters because the
    // brand_events FK is ON DELETE CASCADE — inserting after would violate).
    const recordCallOrder = mockRecordBrandEvent.mock.invocationCallOrder[0]!;
    const deleteCallOrder = mockDb.delete.mock.invocationCallOrder[0]!;
    expect(recordCallOrder).toBeLessThan(deleteCallOrder);
  });

  it('DELETE /brands/:id returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
