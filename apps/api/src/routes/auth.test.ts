import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import bcrypt from 'bcryptjs';
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
import { authRoutes } from './auth.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('auth routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(authRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
  });

  // ── POST /auth/register ────────────────────────────────────────────

  it('POST /auth/register succeeds with new email', async () => {
    mockDb._pushResult([]); // no existing user with that email
    mockDb._pushResult([{ id: USER_ID, email: 'test@test.com' }]); // insert user returning
    mockDb._pushResult(undefined); // insert settings (void)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@test.com', password: 'password123', userName: 'Test User' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
    expect(body.user).toEqual({ id: USER_ID, email: 'test@test.com' });
  });

  it('POST /auth/register returns 409 for duplicate email', async () => {
    mockDb._pushResult([{ id: 'existing-id' }]); // existing user found

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'taken@test.com', password: 'password123', userName: 'Duplicate' },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'CONFLICT' });
  });

  // ── POST /auth/login ───────────────────────────────────────────────

  it('POST /auth/login succeeds with correct credentials', async () => {
    const hash = bcrypt.hashSync('password123', 10);
    mockDb._pushResult([{ id: USER_ID, email: 'test@test.com', passwordHash: hash }]);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@test.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
    expect(body.user).toEqual({ id: USER_ID, email: 'test@test.com' });
  });

  it('POST /auth/login returns 401 for wrong password', async () => {
    const hash = bcrypt.hashSync('differentpassword', 10);
    mockDb._pushResult([{ id: USER_ID, email: 'test@test.com', passwordHash: hash }]);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@test.com', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'UNAUTHORIZED' });
  });

  it('POST /auth/login returns 401 for unknown email', async () => {
    mockDb._pushResult([]); // no user found

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@test.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'UNAUTHORIZED' });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────

  it('GET /auth/me returns user when authenticated', async () => {
    mockDb._pushResult([{ id: USER_ID, email: 'test@test.com' }]);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: USER_ID, email: 'test@test.com' });
  });

  it('GET /auth/me returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });
});
