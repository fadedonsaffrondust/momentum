import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

const { mockDb } = vi.hoisted(() => {
  // Inline mock-db creation so it's available in the hoisted vi.mock factory.
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
import { tasksRoutes } from './tasks.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TASK_ID = 'b1234567-1234-1234-1234-123456789012';

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    userId: USER_ID,
    title: 'Test task',
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
    expect(JSON.parse(res.body)).toMatchObject({
      error: 'BAD_REQUEST',
    });
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

    mockDb._pushResult([existingRow]); // first select to get the task
    mockDb._pushResult([completedRow]); // update returning
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
    mockDb._pushResult([]); // brandActionItems update

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${TASK_ID}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).actualMinutes).toBe(15);
  });

  // ── POST /tasks/:id/pause ──────────────────────────────────────────

  it('POST /tasks/:id/pause sets status to todo and column to up_next', async () => {
    const pausedRow = makeTaskRow({
      status: 'todo',
      column: 'up_next',
      startedAt: new Date('2026-04-15T10:00:00Z'),
    });
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

  // ── DELETE /tasks/:id ──────────────────────────────────────────────

  it('DELETE /tasks/:id returns 404 when task not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('DELETE /tasks/:id returns ok on success', async () => {
    mockDb._pushResult([{ id: TASK_ID }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });
});
