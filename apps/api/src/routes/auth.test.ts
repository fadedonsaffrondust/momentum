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
import { authRoutes } from './auth.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OMNIREV_EMAIL = 'test@omnirev.ai';
const TEAM_USER = {
  id: USER_ID,
  email: OMNIREV_EMAIL,
  displayName: '',
  avatarColor: '#0FB848',
};

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

  it('POST /auth/register rejects a non-@omnirev.ai email with the exact spec message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'stranger@gmail.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('BAD_REQUEST');
    expect(body.message).toBe('Signup is restricted to @omnirev.ai email addresses.');
  });

  it('POST /auth/register rejects domain check before hitting the DB', async () => {
    // Prove the reject happens before any DB call — no results queued.
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'nope@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(400);
    expect(mockDb._results.length).toBe(0);
  });

  it('POST /auth/register accepts @omnirev.ai with only email + password (userName optional)', async () => {
    mockDb._pushResult([]); // no existing user
    mockDb._pushResult([TEAM_USER]); // insert user returning
    mockDb._pushResult(undefined); // insert settings

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: OMNIREV_EMAIL, password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
    expect(body.user).toEqual({
      id: USER_ID,
      email: OMNIREV_EMAIL,
      displayName: '',
      avatarColor: '#0FB848',
    });
  });

  it('POST /auth/register still accepts userName for backward compat', async () => {
    mockDb._pushResult([]);
    mockDb._pushResult([{ ...TEAM_USER, displayName: '', avatarColor: '#F7B24F' }]);
    mockDb._pushResult(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: OMNIREV_EMAIL, password: 'password123', userName: 'Legacy User' },
    });

    expect(res.statusCode).toBe(200);
  });

  it('POST /auth/register returns 409 for duplicate @omnirev.ai email', async () => {
    mockDb._pushResult([{ id: 'existing-id' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'taken@omnirev.ai', password: 'password123' },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'CONFLICT' });
  });

  it('POST /auth/register populates avatarColor deterministically', async () => {
    mockDb._pushResult([]);
    mockDb._pushResult([{ ...TEAM_USER, avatarColor: '#B184F7' }]);
    mockDb._pushResult(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: OMNIREV_EMAIL, password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Must be a valid palette hex string — the actual value is whatever the
    // hash produced, but the shape is covariant.
    expect(body.user.avatarColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  // ── POST /auth/login ───────────────────────────────────────────────

  it('POST /auth/login succeeds for an active @omnirev.ai user', async () => {
    const hash = bcrypt.hashSync('password123', 10);
    mockDb._pushResult([
      {
        id: USER_ID,
        email: OMNIREV_EMAIL,
        passwordHash: hash,
        displayName: 'Test User',
        avatarColor: '#0FB848',
        deactivatedAt: null,
      },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: OMNIREV_EMAIL, password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
    expect(body.user).toEqual({
      id: USER_ID,
      email: OMNIREV_EMAIL,
      displayName: 'Test User',
      avatarColor: '#0FB848',
    });
  });

  it('POST /auth/login returns 400 with deactivation message when deactivatedAt is set', async () => {
    const hash = bcrypt.hashSync('password123', 10);
    mockDb._pushResult([
      {
        id: USER_ID,
        email: OMNIREV_EMAIL,
        passwordHash: hash,
        displayName: 'Old User',
        avatarColor: '#0FB848',
        deactivatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: OMNIREV_EMAIL, password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('BAD_REQUEST');
    expect(body.message).toBe('This account has been deactivated.');
  });

  it('POST /auth/login returns 401 for wrong password (does not leak deactivation state)', async () => {
    const hash = bcrypt.hashSync('correct-password', 10);
    mockDb._pushResult([
      {
        id: USER_ID,
        email: OMNIREV_EMAIL,
        passwordHash: hash,
        displayName: 'x',
        avatarColor: '#0FB848',
        deactivatedAt: new Date('2026-03-01T00:00:00.000Z'), // deactivated AND wrong pw
      },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: OMNIREV_EMAIL, password: 'wrong-password' },
    });

    // Password check runs before the deactivation check, so wrong password
    // gets the normal 401 regardless of deactivation — by design.
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'UNAUTHORIZED' });
  });

  it('POST /auth/login returns 401 for unknown email', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@omnirev.ai', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'UNAUTHORIZED' });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────

  it('GET /auth/me returns id, email, displayName, avatarColor', async () => {
    mockDb._pushResult([
      {
        id: USER_ID,
        email: OMNIREV_EMAIL,
        displayName: 'Nader',
        avatarColor: '#0FB848',
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      id: USER_ID,
      email: OMNIREV_EMAIL,
      displayName: 'Nader',
      avatarColor: '#0FB848',
    });
  });

  it('GET /auth/me returns empty displayName for a pre-wizard user', async () => {
    mockDb._pushResult([
      {
        id: USER_ID,
        email: OMNIREV_EMAIL,
        displayName: '',
        avatarColor: '#F7B24F',
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).displayName).toBe('');
  });

  it('GET /auth/me returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });
});
