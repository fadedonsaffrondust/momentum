import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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
import { statsRoutes } from './stats.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ROLE_ID = 'c1234567-1234-1234-1234-123456789012';

describe('stats routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(statsRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockDb._results.length = 0;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // With fake time at 2026-04-15, the 7-day range is 2026-04-09 through 2026-04-15.

  it('GET /stats/weekly fills timeline gaps with zeros', async () => {
    // Push daily logs for 3 of 7 days (Apr 9, 11, 15).
    mockDb._pushResult([
      { date: '2026-04-09', tasksPlanned: 5, tasksCompleted: 3, completionRate: 0.6, totalEstimatedMinutes: 100, totalActualMinutes: 80 },
      { date: '2026-04-11', tasksPlanned: 4, tasksCompleted: 4, completionRate: 1.0, totalEstimatedMinutes: 60, totalActualMinutes: 55 },
      { date: '2026-04-15', tasksPlanned: 3, tasksCompleted: 2, completionRate: 0.67, totalEstimatedMinutes: 90, totalActualMinutes: 70 },
    ]);
    // Push role counts.
    mockDb._pushResult([{ roleId: ROLE_ID, cnt: 5 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/stats/weekly',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.days).toHaveLength(7);
    // Check that gaps (Apr 10, 12, 13, 14) have zero values.
    const apr10 = body.days.find((d: { date: string }) => d.date === '2026-04-10');
    expect(apr10.tasksCompleted).toBe(0);
    expect(apr10.tasksPlanned).toBe(0);
    expect(apr10.completionRate).toBe(0);
    // Check a day with data.
    const apr11 = body.days.find((d: { date: string }) => d.date === '2026-04-11');
    expect(apr11.tasksCompleted).toBe(4);
    expect(apr11.completionRate).toBe(1.0);
  });

  it('GET /stats/weekly computes streak from end of array backwards', async () => {
    // Last 3 days (Apr 13, 14, 15) have >= 0.8 rate; Apr 12 has < 0.8.
    mockDb._pushResult([
      { date: '2026-04-12', tasksPlanned: 5, tasksCompleted: 2, completionRate: 0.4, totalEstimatedMinutes: 50, totalActualMinutes: 30 },
      { date: '2026-04-13', tasksPlanned: 4, tasksCompleted: 4, completionRate: 1.0, totalEstimatedMinutes: 60, totalActualMinutes: 55 },
      { date: '2026-04-14', tasksPlanned: 3, tasksCompleted: 3, completionRate: 1.0, totalEstimatedMinutes: 45, totalActualMinutes: 40 },
      { date: '2026-04-15', tasksPlanned: 5, tasksCompleted: 4, completionRate: 0.8, totalEstimatedMinutes: 90, totalActualMinutes: 80 },
    ]);
    mockDb._pushResult([]); // no role counts

    const res = await app.inject({
      method: 'GET',
      url: '/stats/weekly',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.streak).toBe(3);
  });

  it('GET /stats/weekly averages only days with tasksPlanned > 0', async () => {
    // 2 days have data, 5 have none.
    mockDb._pushResult([
      { date: '2026-04-10', tasksPlanned: 4, tasksCompleted: 2, completionRate: 0.5, totalEstimatedMinutes: 60, totalActualMinutes: 40 },
      { date: '2026-04-12', tasksPlanned: 6, tasksCompleted: 6, completionRate: 1.0, totalEstimatedMinutes: 90, totalActualMinutes: 85 },
    ]);
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: '/stats/weekly',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Average of 0.5 and 1.0 = 0.75
    expect(body.averageCompletionRate).toBeCloseTo(0.75, 5);
  });

  it('GET /stats/weekly returns all zeros when no data exists', async () => {
    mockDb._pushResult([]); // no logs
    mockDb._pushResult([]); // no role counts

    const res = await app.inject({
      method: 'GET',
      url: '/stats/weekly',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.days).toHaveLength(7);
    expect(body.averageCompletionRate).toBe(0);
    expect(body.mostActiveRoleId).toBeNull();
    expect(body.estimationAccuracy).toBeNull();
    expect(body.streak).toBe(0);
    for (const day of body.days) {
      expect(day.tasksCompleted).toBe(0);
      expect(day.tasksPlanned).toBe(0);
      expect(day.completionRate).toBe(0);
    }
  });
});
