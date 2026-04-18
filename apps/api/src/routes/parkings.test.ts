import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

const { mockDb, mockRecordInboxEvent } = vi.hoisted(() => {
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
  const mockRecordInboxEvent = vi.fn(async (..._args: unknown[]) => undefined);
  return { mockDb, mockRecordInboxEvent };
});

vi.mock('../db.ts', () => ({ db: mockDb, client: {} }));
vi.mock('../services/events.ts', () => ({
  recordInboxEvent: mockRecordInboxEvent,
  recordBrandEvent: vi.fn(async () => undefined),
}));

import { authPlugin } from '../plugins/auth.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { parkingsRoutes } from './parkings.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_USER = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
const THIRD_USER = 'c2ffcd00-ad1c-5ff9-cc7e-7ccaae491b33';
const PARKING_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';

function makeParkingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PARKING_ID,
    creatorId: USER_ID,
    title: 'Test parking',
    notes: null,
    outcome: null,
    targetDate: null,
    roleId: null,
    priority: 'medium',
    status: 'open',
    visibility: 'team',
    involvedIds: [] as string[],
    createdAt: new Date('2026-04-15T08:00:00Z'),
    discussedAt: null,
    ...overrides,
  };
}

describe('parkings routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(parkingsRoutes);
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
    mockRecordInboxEvent.mockClear();
  });

  // ── GET /parkings ──────────────────────────────────────────────────

  it('GET /parkings returns the visibility-filtered list', async () => {
    // The handler issues exactly one SELECT whose WHERE already filters by
    // (visibility='team' OR (visibility='private' AND creator_id=me)). The
    // test only needs to assert the handler runs through and returns the
    // mapped payload — the filter clause itself is a drizzle concern.
    mockDb._pushResult([
      makeParkingRow({ visibility: 'team', creatorId: OTHER_USER }),
      makeParkingRow({
        id: '11111111-1111-1111-1111-111111111111',
        visibility: 'private',
        creatorId: USER_ID,
      }),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/parkings',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(2);
    expect(body[0].visibility).toBe('team');
    expect(body[1].visibility).toBe('private');
  });

  // ── POST /parkings ─────────────────────────────────────────────────

  it('POST /parkings defaults visibility=team, involvedIds=[]', async () => {
    mockDb._pushResult([makeParkingRow()]);

    const res = await app.inject({
      method: 'POST',
      url: '/parkings',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Plain topic' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.visibility).toBe('team');
    expect(body.involvedIds).toEqual([]);
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('POST /parkings with involvedIds fires parking_involvement per user (skipping self)', async () => {
    mockDb._pushResult([
      makeParkingRow({ involvedIds: [USER_ID, OTHER_USER, THIRD_USER] }),
    ]);

    await app.inject({
      method: 'POST',
      url: '/parkings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Pipeline review',
        involvedIds: [USER_ID, OTHER_USER, THIRD_USER],
      },
    });

    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(2);
    const recipients = mockRecordInboxEvent.mock.calls.map(
      (c) => (c[0] as { userId: string }).userId,
    );
    expect(recipients).toEqual([OTHER_USER, THIRD_USER]);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'parking_involvement',
      entityType: 'parking',
    });
  });

  it('POST /parkings dedupes involvedIds in the insert + event call', async () => {
    mockDb._pushResult([makeParkingRow({ involvedIds: [OTHER_USER, OTHER_USER] })]);

    await app.inject({
      method: 'POST',
      url: '/parkings',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'x', involvedIds: [OTHER_USER, OTHER_USER] },
    });

    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
  });

  it('POST /parkings with visibility=private stores it verbatim', async () => {
    mockDb._pushResult([makeParkingRow({ visibility: 'private' })]);

    const res = await app.inject({
      method: 'POST',
      url: '/parkings',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Secret', visibility: 'private' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).visibility).toBe('private');
  });

  // ── PATCH /parkings/:id ────────────────────────────────────────────

  it('PATCH /parkings/:id on a private parking owned by someone else returns 404', async () => {
    mockDb._pushResult([
      makeParkingRow({ visibility: 'private', creatorId: OTHER_USER }),
    ]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'nope' },
    });

    expect(res.statusCode).toBe(404);
    // The select happened; but no update should have run.
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('PATCH /parkings/:id on private owned by me succeeds', async () => {
    const existing = makeParkingRow({ visibility: 'private', creatorId: USER_ID });
    mockDb._pushResult([existing]); // select
    mockDb._pushResult([{ ...existing, title: 'renamed' }]); // update returning

    const res = await app.inject({
      method: 'PATCH',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'renamed' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).title).toBe('renamed');
  });

  it('PATCH /parkings/:id fires inbox events only for newly-added involvedIds', async () => {
    const existing = makeParkingRow({ involvedIds: [OTHER_USER] });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, involvedIds: [OTHER_USER, THIRD_USER] }]);

    await app.inject({
      method: 'PATCH',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { involvedIds: [OTHER_USER, THIRD_USER] },
    });

    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      userId: THIRD_USER,
      eventType: 'parking_involvement',
    });
  });

  it('PATCH /parkings/:id with involvedIds unchanged fires no inbox events', async () => {
    const existing = makeParkingRow({ involvedIds: [OTHER_USER] });
    mockDb._pushResult([existing]);
    mockDb._pushResult([existing]);

    await app.inject({
      method: 'PATCH',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { involvedIds: [OTHER_USER] },
    });

    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('PATCH /parkings/:id adding only self to involvedIds fires no events', async () => {
    const existing = makeParkingRow({ involvedIds: [] });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, involvedIds: [USER_ID] }]);

    await app.inject({
      method: 'PATCH',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { involvedIds: [USER_ID] },
    });

    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('PATCH /parkings/:id without involvedIds in body never inspects deltas', async () => {
    const existing = makeParkingRow({ involvedIds: [OTHER_USER, THIRD_USER] });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, priority: 'high' }]);

    await app.inject({
      method: 'PATCH',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { priority: 'high' },
    });

    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('PATCH /parkings/:id toggling visibility to private is allowed for creator', async () => {
    const existing = makeParkingRow({ visibility: 'team', creatorId: USER_ID });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, visibility: 'private' }]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { visibility: 'private' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).visibility).toBe('private');
  });

  // ── DELETE /parkings/:id ───────────────────────────────────────────

  it('DELETE /parkings/:id on private owned by someone else returns 404', async () => {
    mockDb._pushResult([{ visibility: 'private', creatorId: OTHER_USER }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('DELETE /parkings/:id on team parking by non-creator succeeds (flat perms)', async () => {
    mockDb._pushResult([{ visibility: 'team', creatorId: OTHER_USER }]);
    mockDb._pushResult([{ id: PARKING_ID }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('DELETE /parkings/:id on own private parking succeeds', async () => {
    mockDb._pushResult([{ visibility: 'private', creatorId: USER_ID }]);
    mockDb._pushResult([{ id: PARKING_ID }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('DELETE /parkings/:id returns 404 when parking does not exist', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/parkings/${PARKING_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── discuss / reopen ───────────────────────────────────────────────

  it('POST /parkings/:id/discuss works for a team parking regardless of creator', async () => {
    mockDb._pushResult([{ visibility: 'team', creatorId: OTHER_USER }]);
    mockDb._pushResult([
      makeParkingRow({
        visibility: 'team',
        creatorId: OTHER_USER,
        status: 'discussed',
        discussedAt: new Date('2026-04-17T12:00:00Z'),
      }),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/parkings/${PARKING_ID}/discuss`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('discussed');
  });

  it('POST /parkings/:id/discuss on private owned by someone else returns 404', async () => {
    mockDb._pushResult([{ visibility: 'private', creatorId: OTHER_USER }]);

    const res = await app.inject({
      method: 'POST',
      url: `/parkings/${PARKING_ID}/discuss`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('POST /parkings/:id/reopen resets status to open', async () => {
    mockDb._pushResult([{ visibility: 'team', creatorId: USER_ID }]);
    mockDb._pushResult([
      makeParkingRow({ status: 'open', discussedAt: null }),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/parkings/${PARKING_ID}/reopen`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('open');
    expect(body.discussedAt).toBeNull();
  });
});
