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
import { inboxRoutes } from './inbox.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_USER = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
const EVENT_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TASK_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-04-17T12:00:00Z');

function makeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OTHER_USER,
    email: 'sara@omnirev.ai',
    passwordHash: 'x',
    displayName: 'Sara',
    avatarColor: '#F7B24F',
    deactivatedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    userId: USER_ID,
    actorId: OTHER_USER,
    eventType: 'task_assigned',
    entityType: 'task',
    entityId: TASK_ID,
    payload: { title: 'Review Boudin proposal' },
    readAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('inbox routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(inboxRoutes);
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
  });

  // ── GET /inbox ─────────────────────────────────────────────────────

  it('GET /inbox hydrates actor and task entity', async () => {
    mockDb._pushResult([{ event: makeEventRow(), actor: makeUserRow() }]); // inbox + actor join
    mockDb._pushResult([{ id: TASK_ID, title: 'Review Boudin proposal' }]); // tasks lookup

    const res = await app.inject({
      method: 'GET',
      url: '/inbox',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].actor).toEqual({
      id: OTHER_USER,
      email: 'sara@omnirev.ai',
      displayName: 'Sara',
      avatarColor: '#F7B24F',
      deactivatedAt: null,
    });
    expect(body[0].entity).toEqual({
      id: TASK_ID,
      title: 'Review Boudin proposal',
    });
    expect(body[0].readAt).toBeNull();
  });

  it('GET /inbox hydrates parking entity when entityType is parking', async () => {
    const parkingId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    mockDb._pushResult([
      {
        event: makeEventRow({
          eventType: 'parking_involvement',
          entityType: 'parking',
          entityId: parkingId,
        }),
        actor: makeUserRow(),
      },
    ]);
    mockDb._pushResult([{ id: parkingId, title: 'Pipeline review' }]); // parking lookup

    const res = await app.inject({
      method: 'GET',
      url: '/inbox',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body[0].entity).toEqual({ id: parkingId, title: 'Pipeline review' });
  });

  it('GET /inbox hydrates brand action item with brandId + brandName', async () => {
    const itemId = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const brandId = 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    mockDb._pushResult([
      {
        event: makeEventRow({
          eventType: 'action_item_assigned',
          entityType: 'brand_action_item',
          entityId: itemId,
        }),
        actor: makeUserRow(),
      },
    ]);
    mockDb._pushResult([
      { id: itemId, text: 'Send proposal to Boudin', brandId, brandName: 'Boudin' },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/inbox',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body[0].entity).toEqual({
      id: itemId,
      title: 'Send proposal to Boudin',
      brandId,
      brandName: 'Boudin',
    });
  });

  it('GET /inbox sets entity=null when the underlying entity was deleted', async () => {
    mockDb._pushResult([{ event: makeEventRow(), actor: makeUserRow() }]);
    mockDb._pushResult([]); // task was deleted, nothing returned from tasks lookup

    const res = await app.inject({
      method: 'GET',
      url: '/inbox',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)[0].entity).toBeNull();
  });

  it('GET /inbox skips the entity lookup entirely when there are no events', async () => {
    mockDb._pushResult([]); // no events

    const res = await app.inject({
      method: 'GET',
      url: '/inbox',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
    // Only 1 select call — no hydration batches issued.
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('GET /inbox?unreadOnly=true filter is accepted', async () => {
    mockDb._pushResult([{ event: makeEventRow(), actor: makeUserRow() }]);
    mockDb._pushResult([{ id: TASK_ID, title: 'x' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/inbox?unreadOnly=true',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('GET /inbox?limit=5 is accepted; limit > 200 rejected', async () => {
    mockDb._pushResult([]);

    const ok = await app.inject({
      method: 'GET',
      url: '/inbox?limit=5',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ok.statusCode).toBe(200);

    const tooLarge = await app.inject({
      method: 'GET',
      url: '/inbox?limit=500',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(tooLarge.statusCode).toBe(400);
  });

  it('GET /inbox?cursor=<iso> accepts the cursor', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: `/inbox?cursor=${encodeURIComponent(NOW.toISOString())}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('GET /inbox requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/inbox' });
    expect(res.statusCode).toBe(401);
  });

  // ── GET /inbox/unread-count ────────────────────────────────────────

  it('GET /inbox/unread-count returns the raw count', async () => {
    mockDb._pushResult([{ count: 3 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/inbox/unread-count',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ count: 3 });
  });

  it('GET /inbox/unread-count returns 0 when no rows', async () => {
    mockDb._pushResult([{ count: 0 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/inbox/unread-count',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ count: 0 });
  });

  // ── POST /inbox/:id/read ───────────────────────────────────────────

  it('POST /inbox/:id/read marks one event read', async () => {
    mockDb._pushResult([{ id: EVENT_ID }]);

    const res = await app.inject({
      method: 'POST',
      url: `/inbox/${EVENT_ID}/read`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('POST /inbox/:id/read returns 404 when the event does not belong to the user', async () => {
    mockDb._pushResult([]); // update returns nothing (not theirs OR not found)

    const res = await app.inject({
      method: 'POST',
      url: `/inbox/${EVENT_ID}/read`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── POST /inbox/read-all ───────────────────────────────────────────

  it('POST /inbox/read-all returns the number of events updated', async () => {
    mockDb._pushResult([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/inbox/read-all',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ updated: 3 });
  });

  it('POST /inbox/read-all returns 0 when all were already read', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: '/inbox/read-all',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ updated: 0 });
  });
});
