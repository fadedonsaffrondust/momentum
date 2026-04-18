import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

const { mockDb, mockRecordBrandEvent, mockRecordInboxEvent } = vi.hoisted(() => {
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
  const mockRecordInboxEvent = vi.fn(async (..._args: unknown[]) => undefined);
  return { mockDb, mockRecordBrandEvent, mockRecordInboxEvent };
});

vi.mock('../db.ts', () => ({ db: mockDb, client: {} }));
vi.mock('../services/events.ts', () => ({
  recordBrandEvent: mockRecordBrandEvent,
  recordInboxEvent: mockRecordInboxEvent,
}));

import { authPlugin } from '../plugins/auth.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { brandActionItemsRoutes } from './brand-action-items.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_USER = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
const THIRD_USER = 'c2ffcd00-ad1c-5ff9-cc7e-7ccaae491b33';
const BRAND_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ITEM_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TASK_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-04-17T12:00:00Z');

function makeItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    brandId: BRAND_ID,
    meetingId: null,
    creatorId: USER_ID,
    assigneeId: null,
    text: 'Send proposal to Boudin',
    status: 'open',
    owner: null,
    dueDate: null,
    linkedTaskId: null,
    createdAt: NOW,
    completedAt: null,
    ...overrides,
  };
}

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    creatorId: USER_ID,
    assigneeId: USER_ID,
    title: 'Send proposal to Boudin',
    roleId: null,
    priority: 'medium',
    estimateMinutes: null,
    actualMinutes: null,
    status: 'todo',
    column: 'up_next',
    scheduledDate: '2026-04-17',
    createdAt: NOW,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('brand action items routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(brandActionItemsRoutes);
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
    mockRecordInboxEvent.mockClear();
  });

  // ── GET ────────────────────────────────────────────────────────────

  it('GET returns team-shared action items (no user scoping)', async () => {
    mockDb._pushResult([
      { ...makeItemRow(), meetingDate: '2026-04-10' },
      {
        ...makeItemRow({ id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', creatorId: OTHER_USER }),
        meetingDate: null,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/brands/${BRAND_ID}/action-items`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(2);
  });

  // ── POST ───────────────────────────────────────────────────────────

  it('POST without assigneeId creates an unassigned item and fires only brand event', async () => {
    mockDb._pushResult([makeItemRow({ assigneeId: null })]); // insert returning
    mockDb._pushResult(undefined); // update brands.updatedAt

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'Send proposal to Boudin' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).assigneeId).toBeNull();
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'action_item_created',
      entityType: 'brand_action_item',
      payload: expect.objectContaining({ assigneeId: null }),
    });
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('POST self-assigning fires brand event but no inbox event', async () => {
    mockDb._pushResult([makeItemRow({ assigneeId: USER_ID })]);
    mockDb._pushResult(undefined);

    await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'Self note', assigneeId: USER_ID },
    });

    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('POST cross-assigning fires action_item_assigned inbox event for assignee', async () => {
    mockDb._pushResult([makeItemRow({ assigneeId: OTHER_USER })]);
    mockDb._pushResult(undefined);

    await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'Send proposal', assigneeId: OTHER_USER },
    });

    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'action_item_created',
    });
    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      userId: OTHER_USER,
      actorId: USER_ID,
      eventType: 'action_item_assigned',
      entityType: 'brand_action_item',
    });
  });

  // ── PATCH ──────────────────────────────────────────────────────────

  it('PATCH text edit by non-assignee fires action_item_edited (brand + inbox)', async () => {
    const existing = makeItemRow({ assigneeId: OTHER_USER, creatorId: OTHER_USER });
    mockDb._pushResult([existing]); // select existing
    mockDb._pushResult([{ ...existing, text: 'Updated text' }]); // update returning

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'Updated text' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'action_item_edited',
      payload: expect.objectContaining({ changedFields: ['text'] }),
    });
    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      userId: OTHER_USER,
      actorId: USER_ID,
      eventType: 'action_item_edited',
    });
  });

  it('PATCH text edit by the assignee themselves fires brand event but no inbox', async () => {
    const existing = makeItemRow({ assigneeId: USER_ID });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, text: 'Self edit' }]);

    await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'Self edit' },
    });

    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('PATCH text edit on unassigned item fires brand event only (no inbox target)', async () => {
    const existing = makeItemRow({ assigneeId: null });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, text: 'Tweaked' }]);

    await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'Tweaked' },
    });

    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('PATCH reassignment fires action_item_assigned brand + inbox for new assignee', async () => {
    const existing = makeItemRow({ assigneeId: OTHER_USER });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, assigneeId: THIRD_USER }]);

    await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: THIRD_USER },
    });

    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'action_item_assigned',
      payload: expect.objectContaining({
        previousAssigneeId: OTHER_USER,
        assigneeId: THIRD_USER,
      }),
    });
    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      userId: THIRD_USER,
      eventType: 'action_item_assigned',
    });
  });

  it('PATCH status open->done fires action_item_completed (no inbox event for status)', async () => {
    const existing = makeItemRow({ status: 'open' });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, status: 'done', completedAt: NOW }]);

    await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' },
    });

    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'action_item_completed',
    });
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('PATCH status done->open fires action_item_reopened and clears completedAt', async () => {
    const existing = makeItemRow({ status: 'done', completedAt: NOW });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, status: 'open', completedAt: null }]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'open' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).completedAt).toBeNull();
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'action_item_reopened',
    });
  });

  it('PATCH returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'nope' },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
  });

  // ── DELETE ─────────────────────────────────────────────────────────

  it('DELETE removes an action item', async () => {
    mockDb._pushResult([{ id: ITEM_ID }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('DELETE returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── send-to-today ──────────────────────────────────────────────────

  it('send-to-today requires assigneeId in the body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}/send-to-today`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('send-to-today with self-assignee creates the task without inbox event', async () => {
    const existing = makeItemRow();
    mockDb._pushResult([existing]); // select
    mockDb._pushResult([makeTaskRow({ assigneeId: USER_ID })]); // insert task returning
    mockDb._pushResult([{ ...existing, linkedTaskId: TASK_ID }]); // update action item

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}/send-to-today`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: USER_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.task.assigneeId).toBe(USER_ID);
    expect(body.actionItem.linkedTaskId).toBe(TASK_ID);
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('send-to-today cross-assignee fires task_assigned inbox for assignee', async () => {
    const existing = makeItemRow();
    mockDb._pushResult([existing]);
    mockDb._pushResult([makeTaskRow({ assigneeId: OTHER_USER })]);
    mockDb._pushResult([{ ...existing, linkedTaskId: TASK_ID }]);

    await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}/send-to-today`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: OTHER_USER },
    });

    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      userId: OTHER_USER,
      actorId: USER_ID,
      eventType: 'task_assigned',
      entityType: 'task',
      payload: expect.objectContaining({ source: 'action_item' }),
    });
  });

  it('send-to-today 404 when action item missing', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}/send-to-today`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: USER_ID },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  // ── /complete ──────────────────────────────────────────────────────

  it('/complete emits action_item_completed brand event when transitioning from open', async () => {
    const existing = makeItemRow({ status: 'open' });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, status: 'done', completedAt: NOW }]);

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordBrandEvent.mock.calls[0]![0]).toMatchObject({
      eventType: 'action_item_completed',
    });
  });

  it('/complete on already-done item is idempotent — no duplicate event', async () => {
    const existing = makeItemRow({ status: 'done', completedAt: NOW });
    mockDb._pushResult([existing]);
    mockDb._pushResult([existing]);

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
  });

  it('/complete with linkedTaskId also marks the task done (no user scoping)', async () => {
    const existing = makeItemRow({ status: 'open', linkedTaskId: TASK_ID });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, status: 'done', completedAt: NOW }]);
    mockDb._pushResult(undefined); // task update (team-shared, no scoping)

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    // Two updates called: the action item + the linked task.
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('/complete returns 404 when not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: `/brands/${BRAND_ID}/action-items/${ITEM_ID}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecordBrandEvent).not.toHaveBeenCalled();
  });
});
