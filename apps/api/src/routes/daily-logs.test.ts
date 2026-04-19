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
import { dailyLogsRoutes } from './daily-logs.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOG_ID = 'd1234567-1234-1234-1234-123456789012';

function makeDailyLogRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LOG_ID,
    userId: USER_ID,
    date: '2026-04-15',
    tasksPlanned: 0,
    tasksCompleted: 0,
    totalEstimatedMinutes: 0,
    totalActualMinutes: 0,
    journalEntry: null,
    completionRate: 0,
    ...overrides,
  };
}

describe('daily-logs routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(dailyLogsRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
  });

  // ── POST /daily-logs ───────────────────────────────────────────────

  it('POST /daily-logs computes stats from 3 tasks (2 done)', async () => {
    // First query: select tasks for the date
    mockDb._pushResult([
      { status: 'done', estimateMinutes: 30, actualMinutes: 25 },
      { status: 'done', estimateMinutes: 60, actualMinutes: 45 },
      { status: 'todo', estimateMinutes: 15, actualMinutes: null },
    ]);

    // Second query: upsert daily log returning
    const logRow = makeDailyLogRow({
      tasksPlanned: 3,
      tasksCompleted: 2,
      totalEstimatedMinutes: 105,
      totalActualMinutes: 70,
      completionRate: 2 / 3,
    });
    mockDb._pushResult([logRow]);

    const res = await app.inject({
      method: 'POST',
      url: '/daily-logs',
      headers: { authorization: `Bearer ${token}` },
      payload: { date: '2026-04-15' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tasksPlanned).toBe(3);
    expect(body.tasksCompleted).toBe(2);
    expect(body.totalEstimatedMinutes).toBe(105);
    expect(body.totalActualMinutes).toBe(70);
    expect(body.completionRate).toBeCloseTo(2 / 3, 5);
  });

  it('POST /daily-logs with 0 tasks sets completionRate to 0', async () => {
    mockDb._pushResult([]); // no tasks for the date

    const logRow = makeDailyLogRow({
      tasksPlanned: 0,
      tasksCompleted: 0,
      totalEstimatedMinutes: 0,
      totalActualMinutes: 0,
      completionRate: 0,
    });
    mockDb._pushResult([logRow]);

    const res = await app.inject({
      method: 'POST',
      url: '/daily-logs',
      headers: { authorization: `Bearer ${token}` },
      payload: { date: '2026-04-15' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tasksPlanned).toBe(0);
    expect(body.completionRate).toBe(0);
  });

  // ── GET /daily-logs/:date ──────────────────────────────────────────

  it('GET /daily-logs/:date returns 404 when no log exists', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: '/daily-logs/2026-04-15',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'NOT_FOUND' });
  });
});
