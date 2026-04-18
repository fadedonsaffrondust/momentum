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
import { brandStakeholdersRoutes } from './brand-stakeholders.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const BRAND_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const STAKEHOLDER_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-04-17T12:00:00Z');

function makeStakeholderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STAKEHOLDER_ID,
    brandId: BRAND_ID,
    name: 'Jane Doe',
    email: 'jane@client.com',
    role: 'VP Marketing',
    notes: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('brand stakeholders routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(brandStakeholdersRoutes);
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

  it('GET returns the stakeholder list (no user scoping)', async () => {
    mockDb._pushResult([makeStakeholderRow(), makeStakeholderRow({ id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'John' })]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/stakeholders`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(2);
  });

  it('POST emits stakeholder_added', async () => {
    mockDb._pushResult([makeStakeholderRow()]); // insert returning
    mockDb._pushResult(undefined); // update brand updatedAt

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/stakeholders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Jane Doe', email: 'jane@client.com', role: 'VP Marketing' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      brandId: BRAND_ID,
      actorId: USER_ID,
      eventType: 'stakeholder_added',
      entityType: 'brand_stakeholder',
      entityId: STAKEHOLDER_ID,
      payload: expect.objectContaining({ name: 'Jane Doe', email: 'jane@client.com' }),
    });
  });

  it('PATCH emits stakeholder_edited with changedFields', async () => {
    mockDb._pushResult([makeStakeholderRow({ role: 'CMO' })]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/stakeholders/${STAKEHOLDER_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'CMO' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'stakeholder_edited',
      entityId: STAKEHOLDER_ID,
      payload: expect.objectContaining({ changedFields: ['role'] }),
    });
  });

  it('PATCH returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/stakeholders/${STAKEHOLDER_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X' },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
  });

  it('DELETE emits stakeholder_removed before deleting', async () => {
    mockDb._pushResult([{ id: STAKEHOLDER_ID, name: 'Jane Doe' }]); // select
    mockDb._pushResult([{ id: STAKEHOLDER_ID }]); // delete returning

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}/stakeholders/${STAKEHOLDER_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'stakeholder_removed',
      payload: expect.objectContaining({ name: 'Jane Doe' }),
    });
    // Event recorded before delete.
    const recordCallOrder = mockRecordBrandEvent.mock.invocationCallOrder[0]!;
    const deleteCallOrder = mockDb.delete.mock.invocationCallOrder[0]!;
    expect(recordCallOrder).toBeLessThan(deleteCallOrder);
  });

  it('DELETE returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}/stakeholders/${STAKEHOLDER_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
