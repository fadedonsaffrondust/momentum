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
import { tasksRoutes } from './tasks.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_USER = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
const THIRD_USER = 'c2ffcd00-ad1c-5ff9-cc7e-7ccaae491b33';
const TASK_ID = 'b1234567-1234-1234-1234-123456789012';

/**
 * The default mockDb.update proxy swallows method-call arguments (it
 * returns itself for any access), so there's no way to assert what was
 * passed to `.set({...})`. For tests that need to introspect the
 * Drizzle UPDATE payload (e.g. invariant coercion), temporarily swap
 * `mockDb.update` for a hand-rolled chain that captures `.set()`'s
 * values. Always restored via try/finally so one test's overrides
 * can't leak into the next.
 */
async function withCapturedUpdate(
  body: (captured: {
    setValues: Record<string, unknown> | null;
    returning: unknown[];
  }) => Promise<void>,
): Promise<void> {
  const captured: { setValues: Record<string, unknown> | null; returning: unknown[] } = {
    setValues: null,
    returning: [],
  };
  const originalUpdate = mockDb.update;
  mockDb.update = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.set = (values: Record<string, unknown>) => {
      captured.setValues = values;
      return chain;
    };
    chain.where = () => chain;
    chain.returning = () => Promise.resolve(captured.returning);
    return chain;
  });
  try {
    await body(captured);
  } finally {
    mockDb.update = originalUpdate;
  }
}

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    creatorId: USER_ID,
    assigneeId: USER_ID,
    title: 'Test task',
    description: null,
    roleId: null,
    priority: 'medium',
    estimateMinutes: 30,
    actualMinutes: null,
    status: 'todo',
    column: 'up_next',
    scheduledDate: '2026-04-15',
    createdAt: new Date('2026-04-15T08:00:00Z'),
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function makeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'nader@omnirev.ai',
    passwordHash: 'x',
    displayName: 'Nader',
    avatarColor: '#0FB848',
    deactivatedAt: null,
    createdAt: new Date('2026-04-15T08:00:00Z'),
    ...overrides,
  };
}

describe('tasks routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(tasksRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
    mockRecordInboxEvent.mockClear();
  });

  // ── POST /tasks ────────────────────────────────────────────────────

  it('POST /tasks without assigneeId defaults both creator and assignee to the current user', async () => {
    mockDb._pushResult([makeTaskRow()]);

    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'self-owned' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.creatorId).toBe(USER_ID);
    expect(body.assigneeId).toBe(USER_ID);
    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('POST /tasks with a different assigneeId fires task_assigned inbox event', async () => {
    mockDb._pushResult([makeTaskRow({ assigneeId: OTHER_USER, creatorId: USER_ID })]);

    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Review proposal', assigneeId: OTHER_USER },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      userId: OTHER_USER,
      actorId: USER_ID,
      eventType: 'task_assigned',
      entityType: 'task',
      entityId: TASK_ID,
    });
  });

  it('POST /tasks explicitly self-assigning still suppresses the inbox event', async () => {
    mockDb._pushResult([makeTaskRow()]);

    await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'x', assigneeId: USER_ID },
    });

    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('POST /tasks round-trips a description field', async () => {
    mockDb._pushResult([makeTaskRow({ description: '## Definition of done\n- [ ] Shipped' })]);

    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'x', description: '## Definition of done\n- [ ] Shipped' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).description).toContain('Definition of done');
  });

  // ── PATCH /tasks/:id ───────────────────────────────────────────────

  it('PATCH /tasks/:id non-assignee edits a field fires task_edited', async () => {
    // Task created by THIRD_USER, assigned to OTHER_USER. Current user
    // (USER_ID, actor) edits the title — should fire task_edited for
    // OTHER_USER because actor ≠ assignee AND assignee ≠ creator.
    const existing = makeTaskRow({ creatorId: THIRD_USER, assigneeId: OTHER_USER });
    mockDb._pushResult([existing]); // select existing
    mockDb._pushResult([{ ...existing, title: 'new title' }]); // update returning

    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'new title' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      userId: OTHER_USER,
      actorId: USER_ID,
      eventType: 'task_edited',
      entityType: 'task',
      entityId: TASK_ID,
      payload: expect.objectContaining({ changedFields: ['title'] }),
    });
  });

  it('PATCH /tasks/:id skips task_edited when assignee === creator (self-owned task)', async () => {
    // Task owned end-to-end by OTHER_USER (creator=assignee). Current user
    // (USER_ID) edits the priority. Per spec §7.1 the condition
    // `assignee ≠ creator` fails, so no inbox event fires — the carve-out
    // for self-owned tasks.
    const existing = makeTaskRow({ creatorId: OTHER_USER, assigneeId: OTHER_USER });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ ...existing, priority: 'high' }]);

    await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { priority: 'high' },
    });

    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('PATCH /tasks/:id assignee editing their own task fires no event', async () => {
    const existing = makeTaskRow({ creatorId: OTHER_USER, assigneeId: USER_ID });
    mockDb._pushResult([existing]);
    mockDb._pushResult([makeTaskRow({ ...existing, title: 'self-edit' })]);

    await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'self-edit' },
    });

    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  it('PATCH /tasks/:id updates description and returns it', async () => {
    const existing = makeTaskRow({ creatorId: USER_ID, assigneeId: USER_ID });
    mockDb._pushResult([existing]);
    mockDb._pushResult([makeTaskRow({ ...existing, description: 'New context.' })]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { description: 'New context.' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).description).toBe('New context.');
  });

  it('PATCH /tasks/:id clears the description when sent as null', async () => {
    const existing = makeTaskRow({
      creatorId: USER_ID,
      assigneeId: USER_ID,
      description: 'Previously set.',
    });
    mockDb._pushResult([existing]);
    mockDb._pushResult([makeTaskRow({ ...existing, description: null })]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { description: null },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).description).toBeNull();
  });

  it('PATCH /tasks/:id reassignment fires task_assigned for new assignee', async () => {
    const existing = makeTaskRow({ creatorId: USER_ID, assigneeId: USER_ID });
    mockDb._pushResult([existing]); // select existing
    mockDb._pushResult([makeTaskRow({ ...existing, assigneeId: OTHER_USER })]); // update returning

    await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: OTHER_USER },
    });

    expect(mockRecordInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordInboxEvent.mock.calls[0]![0]).toMatchObject({
      userId: OTHER_USER,
      eventType: 'task_assigned',
      payload: expect.objectContaining({ previousAssigneeId: USER_ID }),
    });
  });

  it('PATCH /tasks/:id reassignment-over-capacity resets to todo/up_next (spec §16.1)', async () => {
    // Task is in_progress, being reassigned to OTHER_USER who already has
    // 2 in-progress. Expect the task to be persisted as todo/up_next.
    const existing = makeTaskRow({
      creatorId: USER_ID,
      assigneeId: USER_ID,
      status: 'in_progress',
      column: 'in_progress',
    });
    mockDb._pushResult([existing]); // select existing
    mockDb._pushResult([{ inProgressCount: 2 }]); // capacity check
    const updated = makeTaskRow({
      ...existing,
      assigneeId: OTHER_USER,
      status: 'todo',
      column: 'up_next',
    });
    mockDb._pushResult([updated]); // update returning

    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: OTHER_USER },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('todo');
    expect(body.column).toBe('up_next');
    expect(body.assigneeId).toBe(OTHER_USER);
  });

  it('PATCH /tasks/:id reassignment keeps in_progress when new assignee has capacity', async () => {
    const existing = makeTaskRow({
      creatorId: USER_ID,
      assigneeId: USER_ID,
      status: 'in_progress',
      column: 'in_progress',
    });
    mockDb._pushResult([existing]);
    mockDb._pushResult([{ inProgressCount: 1 }]); // room for one more
    mockDb._pushResult([
      makeTaskRow({
        ...existing,
        assigneeId: OTHER_USER,
        status: 'in_progress',
        column: 'in_progress',
      }),
    ]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: OTHER_USER },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('in_progress');
    expect(body.assigneeId).toBe(OTHER_USER);
  });

  it('PATCH /tasks/:id reassignment of a todo task skips the capacity check', async () => {
    // Task is not in_progress, so reassignment is free regardless of
    // new assignee's capacity.
    const existing = makeTaskRow({ creatorId: USER_ID, assigneeId: USER_ID });
    mockDb._pushResult([existing]);
    // No capacity-check result queued — if the route tried to run it,
    // the mock would return undefined and the `.from(...).where(...)`
    // chain would fail. Its absence is the assertion.
    mockDb._pushResult([makeTaskRow({ ...existing, assigneeId: OTHER_USER })]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { assigneeId: OTHER_USER },
    });

    expect(res.statusCode).toBe(200);
  });

  it("PATCH /tasks/:id setting column='up_next' without status coerces status='todo' and clears startedAt (fixes in_progress→up_next zombie state)", async () => {
    // Regression test: "Plan My Day → Move to today" on a task that was
    // in_progress yesterday used to send { scheduledDate, column:'up_next' }
    // and leave status='in_progress' behind, producing a task that the
    // Today board didn't render (renders by column) but that still
    // counted against the MAX_IN_PROGRESS cap (reads status). The PATCH
    // handler now coerces status + startedAt when column is reset.
    await withCapturedUpdate(async (captured) => {
      const existing = makeTaskRow({
        status: 'in_progress',
        column: 'in_progress',
        startedAt: new Date('2026-04-14T15:00:00Z'),
        scheduledDate: '2026-04-14',
      });
      mockDb._pushResult([existing]);
      captured.returning = [
        makeTaskRow({
          ...existing,
          status: 'todo',
          column: 'up_next',
          startedAt: null,
          scheduledDate: '2026-04-15',
        }),
      ];

      const res = await app.inject({
        method: 'PATCH',
        url: `/tasks/${TASK_ID}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { scheduledDate: '2026-04-15', column: 'up_next' },
      });

      expect(res.statusCode).toBe(200);
      expect(captured.setValues).toMatchObject({
        column: 'up_next',
        status: 'todo',
        startedAt: null,
        scheduledDate: '2026-04-15',
      });
    });
  });

  it('PATCH /tasks/:id respects an explicit status even when column is set (no coercion when caller is explicit)', async () => {
    await withCapturedUpdate(async (captured) => {
      mockDb._pushResult([makeTaskRow()]);
      captured.returning = [makeTaskRow({ status: 'in_progress', column: 'up_next' })];

      const res = await app.inject({
        method: 'PATCH',
        url: `/tasks/${TASK_ID}`,
        headers: { authorization: `Bearer ${token}` },
        // Pathological-but-explicit: caller sends both, so honor what
        // they said and don't overwrite status with the column-derived
        // default.
        payload: { column: 'up_next', status: 'in_progress' },
      });

      expect(res.statusCode).toBe(200);
      expect(captured.setValues).toMatchObject({ column: 'up_next', status: 'in_progress' });
      // startedAt is only cleared in the coercion branch, which we
      // skipped because `status` was explicit.
      expect(captured.setValues!).not.toHaveProperty('startedAt');
    });
  });

  // ── POST /tasks/:id/start ───────────────────────────────────────────

  it('POST /tasks/:id/start returns 400 when 2 tasks already in progress', async () => {
    mockDb._pushResult([{ inProgressCount: 2 }]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/start`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'BAD_REQUEST' });
  });

  it('POST /tasks/:id/start succeeds when fewer than 2 in progress', async () => {
    const updatedRow = makeTaskRow({
      status: 'in_progress',
      column: 'in_progress',
      startedAt: new Date('2026-04-15T10:00:00Z'),
    });
    mockDb._pushResult([{ inProgressCount: 1 }]);
    mockDb._pushResult([updatedRow]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/start`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('in_progress');
    expect(body.column).toBe('in_progress');
    expect(body.startedAt).toBe('2026-04-15T10:00:00.000Z');
  });

  // ── POST /tasks/:id/complete ────────────────────────────────────────

  it('POST /tasks/:id/complete calculates actualMinutes from startedAt', async () => {
    const now = new Date('2026-04-15T12:30:00Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    const startedAt = new Date('2026-04-15T12:00:00Z'); // 30 min ago
    const existingRow = makeTaskRow({
      status: 'in_progress',
      column: 'in_progress',
      startedAt,
    });
    const completedRow = makeTaskRow({
      status: 'done',
      column: 'done',
      startedAt,
      actualMinutes: 30,
      completedAt: new Date('2026-04-15T12:30:00Z'),
    });

    mockDb._pushResult([existingRow]);
    mockDb._pushResult([completedRow]);
    mockDb._pushResult([]); // brandActionItems update

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('done');
    expect(body.actualMinutes).toBe(30);

    dateNowSpy.mockRestore();
  });

  it('POST /tasks/:id/complete preserves existing actualMinutes when no startedAt', async () => {
    const existingRow = makeTaskRow({
      status: 'in_progress',
      column: 'in_progress',
      startedAt: null,
      actualMinutes: 15,
    });
    const completedRow = makeTaskRow({
      status: 'done',
      column: 'done',
      actualMinutes: 15,
      completedAt: new Date('2026-04-15T12:30:00Z'),
    });

    mockDb._pushResult([existingRow]);
    mockDb._pushResult([completedRow]);
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).actualMinutes).toBe(15);
  });

  it('POST /tasks/:id/complete accumulates current session onto prior actualMinutes', async () => {
    // Scenario: task was started, paused (15min logged), restarted, then
    // completed 10 min into the second session. Expect 15 + 10 = 25.
    const now = new Date('2026-04-15T12:10:00Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    const existingRow = makeTaskRow({
      status: 'in_progress',
      column: 'in_progress',
      startedAt: new Date('2026-04-15T12:00:00Z'), // current session, 10 min ago
      actualMinutes: 15, // prior session(s)
    });
    const completedRow = makeTaskRow({
      status: 'done',
      column: 'done',
      startedAt: null,
      actualMinutes: 25,
      completedAt: new Date('2026-04-15T12:10:00Z'),
    });

    mockDb._pushResult([existingRow]);
    mockDb._pushResult([completedRow]);
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.actualMinutes).toBe(25);
    expect(body.startedAt).toBeNull();

    dateNowSpy.mockRestore();
  });

  // ── POST /tasks/:id/pause ──────────────────────────────────────────

  it('POST /tasks/:id/pause sets status to todo and column to up_next', async () => {
    const existingRow = makeTaskRow({
      status: 'in_progress',
      column: 'in_progress',
      startedAt: null,
      actualMinutes: null,
    });
    const pausedRow = makeTaskRow({
      status: 'todo',
      column: 'up_next',
      startedAt: null,
    });
    mockDb._pushResult([existingRow]);
    mockDb._pushResult([pausedRow]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/pause`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('todo');
    expect(body.column).toBe('up_next');
  });

  it('POST /tasks/:id/pause accumulates session elapsed into actualMinutes and clears startedAt', async () => {
    const now = new Date('2026-04-15T12:30:00Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    const existingRow = makeTaskRow({
      status: 'in_progress',
      column: 'in_progress',
      startedAt: new Date('2026-04-15T12:00:00Z'), // 30 min ago
      actualMinutes: 15, // prior session logged 15 min
    });
    const pausedRow = makeTaskRow({
      status: 'todo',
      column: 'up_next',
      startedAt: null,
      actualMinutes: 45, // 15 + 30
    });
    mockDb._pushResult([existingRow]);
    mockDb._pushResult([pausedRow]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/pause`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.actualMinutes).toBe(45);
    expect(body.startedAt).toBeNull();

    dateNowSpy.mockRestore();
  });

  it('POST /tasks/:id/pause with no startedAt leaves actualMinutes unchanged', async () => {
    const existingRow = makeTaskRow({
      status: 'in_progress',
      column: 'in_progress',
      startedAt: null,
      actualMinutes: 20,
    });
    const pausedRow = makeTaskRow({
      status: 'todo',
      column: 'up_next',
      startedAt: null,
      actualMinutes: 20,
    });
    mockDb._pushResult([existingRow]);
    mockDb._pushResult([pausedRow]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/pause`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).actualMinutes).toBe(20);
  });

  it('POST /tasks/:id/pause returns 404 when task not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/pause`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── POST /tasks/:id/reopen ─────────────────────────────────────────

  it('POST /tasks/:id/reopen returns task reset to todo/up_next with completion fields cleared', async () => {
    const reopenedRow = makeTaskRow({
      status: 'todo',
      column: 'up_next',
      startedAt: null,
      completedAt: null,
      actualMinutes: 45,
    });
    mockDb._pushResult([reopenedRow]);
    mockDb._pushResult([]); // brandActionItems update

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/reopen`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('todo');
    expect(body.column).toBe('up_next');
    expect(body.completedAt).toBeNull();
    expect(body.startedAt).toBeNull();
    // actualMinutes is preserved as a record of prior work on the task.
    expect(body.actualMinutes).toBe(45);
  });

  it('POST /tasks/:id/reopen returns 404 when task not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/reopen`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── POST /tasks/:id/defer ──────────────────────────────────────────

  it('POST /tasks/:id/defer with explicit scheduledDate defers to that date', async () => {
    const deferredRow = makeTaskRow({
      status: 'todo',
      column: 'up_next',
      scheduledDate: '2026-04-20',
    });
    mockDb._pushResult([deferredRow]);

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/defer`,
      headers: { authorization: `Bearer ${token}` },
      payload: { scheduledDate: '2026-04-20' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).scheduledDate).toBe('2026-04-20');
  });

  it('POST /tasks/:id/start, /pause, /complete, /defer fire no inbox events', async () => {
    // One inject per transition; confirms self-action doesn't notify
    mockDb._pushResult([{ inProgressCount: 0 }]);
    mockDb._pushResult([makeTaskRow({ status: 'in_progress', column: 'in_progress' })]);

    await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/start`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(mockRecordInboxEvent).not.toHaveBeenCalled();
  });

  // ── DELETE /tasks/:id ──────────────────────────────────────────────

  it('DELETE /tasks/:id returns 404 when task not found', async () => {
    mockDb._pushResult([]); // attachment-keys snapshot
    mockDb._pushResult([]); // task delete returning

    const res = await app.inject({
      method: 'DELETE',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('DELETE /tasks/:id returns ok on success', async () => {
    mockDb._pushResult([]); // attachment-keys snapshot (no attachments)
    mockDb._pushResult([{ id: TASK_ID }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  // ── GET /tasks ────────────────────────────────────────────────────

  it('GET /tasks with no filters returns current user as assignee by default', async () => {
    const ownTask = makeTaskRow({ assigneeId: USER_ID });
    mockDb._pushResult([ownTask]);

    const res = await app.inject({
      method: 'GET',
      url: '/tasks',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });

  it('GET /tasks?assigneeId=ALL is accepted (team-wide)', async () => {
    mockDb._pushResult([
      makeTaskRow({ assigneeId: USER_ID }),
      makeTaskRow({
        id: 'c1234567-1234-1234-1234-123456789012',
        assigneeId: OTHER_USER,
        creatorId: OTHER_USER,
      }),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/tasks?assigneeId=ALL',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(2);
  });

  // ── GET /tasks/team ───────────────────────────────────────────────

  it('GET /tasks/team groups tasks by assignee with current user first', async () => {
    mockDb._pushResult([
      makeUserRow({ id: USER_ID, displayName: 'Nader' }),
      makeUserRow({ id: OTHER_USER, displayName: 'Alice', email: 'alice@omnirev.ai' }),
      makeUserRow({ id: THIRD_USER, displayName: 'Zara', email: 'zara@omnirev.ai' }),
    ]);
    mockDb._pushResult([
      makeTaskRow({ assigneeId: USER_ID }),
      makeTaskRow({
        id: 'c1234567-1234-1234-1234-123456789012',
        assigneeId: OTHER_USER,
        creatorId: OTHER_USER,
      }),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/tasks/team',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sections).toHaveLength(3);
    // current user first
    expect(body.sections[0].user.id).toBe(USER_ID);
    expect(body.sections[0].tasks).toHaveLength(1);
    // Alice section (alpha-ordered by displayName)
    expect(body.sections[1].user.id).toBe(OTHER_USER);
    expect(body.sections[1].tasks).toHaveLength(1);
    // Zara section — no tasks
    expect(body.sections[2].user.id).toBe(THIRD_USER);
    expect(body.sections[2].tasks).toHaveLength(0);
  });

  it('GET /tasks/team returns empty sections when no active users', async () => {
    mockDb._pushResult([]); // no active users
    mockDb._pushResult([]); // no tasks

    const res = await app.inject({
      method: 'GET',
      url: '/tasks/team',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).sections).toEqual([]);
  });
});
