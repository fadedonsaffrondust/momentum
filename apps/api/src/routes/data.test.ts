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
  const mockDb: any = {
    select: vi.fn((..._args: unknown[]) => createChain()),
    insert: vi.fn((..._args: unknown[]) => createChain()),
    update: vi.fn((..._args: unknown[]) => createChain()),
    delete: vi.fn((..._args: unknown[]) => createChain()),
    transaction: vi.fn(async (cb: (tx: typeof mockDb) => unknown) => cb(mockDb)),
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
import { dataRoutes } from './data.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const EMPTY_FILE = {
  version: '1.4' as const,
  exportedAt: new Date().toISOString(),
  settings: {
    dailyCapacityMinutes: 480,
    theme: 'dark' as const,
    userName: 'Test User',
    lastExportDate: null,
    onboarded: true,
  },
  roles: [],
  tasks: [],
  dailyLogs: [],
  parkings: [],
  brands: [],
  brandStakeholders: [],
  brandMeetings: [],
  brandActionItems: [],
  brandFeatureRequests: [],
  users: [],
  brandEvents: [],
  inboxEvents: [],
};

describe('data routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(dataRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
    mockDb.transaction.mockClear();
  });

  // ── POST /import ───────────────────────────────────────────────────

  it('POST /import requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/import',
      payload: { mode: 'merge', file: EMPTY_FILE },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /import wraps the handler in a single db.transaction', async () => {
    // Empty merge: only the settings update consumes a result.
    mockDb._pushResult(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/import',
      payload: { mode: 'merge', file: EMPTY_FILE },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.imported).toEqual({
      tasks: 0,
      roles: 0,
      dailyLogs: 0,
      parkings: 0,
      brands: 0,
      brandStakeholders: 0,
      brandMeetings: 0,
      brandActionItems: 0,
      brandFeatureRequests: 0,
    });
  });

  it('POST /import surfaces an error if a write throws inside the transaction', async () => {
    // Settings update succeeds, then the first role insert throws.
    // Postgres would roll the whole transaction back; in tests we just
    // assert that the error is propagated to the client (i.e. the route
    // doesn't accidentally swallow mid-import failures and return 200).
    mockDb._pushResult(undefined); // settings update
    mockDb._pushResult(new Error('simulated insert failure'));

    const res = await app.inject({
      method: 'POST',
      url: '/import',
      payload: {
        mode: 'merge',
        file: {
          ...EMPTY_FILE,
          roles: [{ id: 'fake-role-id', name: 'Test', color: '#0FB848', position: 0 }],
        },
      },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(500);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});
