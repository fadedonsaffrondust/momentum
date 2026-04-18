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
  return { mockDb };
});

vi.mock('../db.ts', () => ({ db: mockDb, client: {} }));

import { authPlugin } from '../plugins/auth.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { brandEventsRoutes } from './brand-events.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ACTOR_ID = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
const BRAND_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const EVENT_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ENTITY_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-04-17T12:00:00Z');

function makeActorRow() {
  return {
    id: ACTOR_ID,
    email: 'sara@omnirev.ai',
    passwordHash: 'x',
    displayName: 'Sara',
    avatarColor: '#F7B24F',
    deactivatedAt: null,
    createdAt: NOW,
  };
}

function makeEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    brandId: BRAND_ID,
    actorId: ACTOR_ID,
    eventType: 'action_item_completed',
    entityType: 'brand_action_item',
    entityId: ENTITY_ID,
    payload: { text: 'Send proposal to Boudin' },
    createdAt: NOW,
    ...overrides,
  };
}

describe('brand events routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(brandEventsRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
    mockDb.select.mockClear();
  });

  it('GET /brands/:brandId/events returns events with hydrated actor', async () => {
    mockDb._pushResult([{ event: makeEventRow(), actor: makeActorRow() }]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/events`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: EVENT_ID,
      brandId: BRAND_ID,
      eventType: 'action_item_completed',
      entityId: ENTITY_ID,
      actor: {
        id: ACTOR_ID,
        displayName: 'Sara',
        avatarColor: '#F7B24F',
      },
    });
  });

  it('GET /brands/:brandId/events returns empty list when no events exist', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/events`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('GET /brands/:brandId/events?limit=5 accepted', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/events?limit=5`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('GET /brands/:brandId/events rejects limit > 100', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/events?limit=500`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('GET /brands/:brandId/events?cursor=<iso> accepts the cursor', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/events?cursor=${encodeURIComponent(NOW.toISOString())}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('GET /brands/:brandId/events rejects invalid cursor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/events?cursor=yesterday`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('GET /brands/:brandId/events handles null entityId (brand-level event)', async () => {
    mockDb._pushResult([
      {
        event: makeEventRow({ eventType: 'brand_edited', entityId: null }),
        actor: makeActorRow(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/events`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)[0].entityId).toBeNull();
  });

  it('GET /brands/:brandId/events rejects non-uuid brandId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/brands/not-a-uuid/events',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('GET /brands/:brandId/events requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/events`,
    });
    expect(res.statusCode).toBe(401);
  });
});
