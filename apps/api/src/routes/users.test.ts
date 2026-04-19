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
import { usersRoutes } from './users.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const USER_ID_2 = 'b1ffcd00-ad1c-5ff9-cc7e-7ccaae491b22';
const USER_ID_3 = 'c2ffcd00-ad1c-5ff9-cc7e-7ccaae491b33';
const EMAIL = 'nader@omnirev.ai';
const NOW = new Date('2026-04-17T12:00:00.000Z');

describe('users routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(usersRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
  });

  // ── GET /users ─────────────────────────────────────────────────────

  it('GET /users returns the active team roster as UserSummary[]', async () => {
    mockDb._pushResult([
      {
        id: USER_ID,
        email: EMAIL,
        passwordHash: 'x',
        displayName: 'Nader',
        avatarColor: '#0FB848',
        deactivatedAt: null,
        createdAt: NOW,
      },
      {
        id: USER_ID_2,
        email: 'sara@omnirev.ai',
        passwordHash: 'x',
        displayName: 'Sara',
        avatarColor: '#F7B24F',
        deactivatedAt: null,
        createdAt: NOW,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual([
      {
        id: USER_ID,
        email: EMAIL,
        displayName: 'Nader',
        avatarColor: '#0FB848',
        deactivatedAt: null,
      },
      {
        id: USER_ID_2,
        email: 'sara@omnirev.ai',
        displayName: 'Sara',
        avatarColor: '#F7B24F',
        deactivatedAt: null,
      },
    ]);
    // passwordHash and createdAt must never leak to the wire.
    expect(body[0]).not.toHaveProperty('passwordHash');
    expect(body[0]).not.toHaveProperty('createdAt');
  });

  it('GET /users returns empty array when no active users exist', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('GET /users requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/users' });
    expect(res.statusCode).toBe(401);
  });

  // ── GET /users/:id ─────────────────────────────────────────────────

  it('GET /users/:id returns a single active user as UserSummary', async () => {
    mockDb._pushResult([
      {
        id: USER_ID_3,
        email: 'ryan@omnirev.ai',
        passwordHash: 'x',
        displayName: 'Ryan',
        avatarColor: '#4FD1C5',
        deactivatedAt: null,
        createdAt: NOW,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/users/${USER_ID_3}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      id: USER_ID_3,
      email: 'ryan@omnirev.ai',
      displayName: 'Ryan',
      avatarColor: '#4FD1C5',
      deactivatedAt: null,
    });
  });

  it('GET /users/:id returns a deactivated user (for historical hydration)', async () => {
    mockDb._pushResult([
      {
        id: USER_ID_3,
        email: 'old@omnirev.ai',
        passwordHash: 'x',
        displayName: 'Old User',
        avatarColor: '#0FB848',
        deactivatedAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: NOW,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/users/${USER_ID_3}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.deactivatedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(body.displayName).toBe('Old User');
  });

  it('GET /users/:id returns 404 when the user does not exist', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'GET',
      url: `/users/${USER_ID_2}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('GET /users/:id rejects a non-uuid id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(mockDb._results.length).toBe(0);
  });

  it('GET /users/:id requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/users/${USER_ID_2}` });
    expect(res.statusCode).toBe(401);
  });

  // ── PATCH /users/me ────────────────────────────────────────────────

  it('updates displayName and returns the full auth user shape', async () => {
    mockDb._pushResult([
      {
        id: USER_ID,
        email: EMAIL,
        displayName: 'Nader Samadyan',
        avatarColor: '#0FB848',
      },
    ]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { displayName: 'Nader Samadyan' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      id: USER_ID,
      email: EMAIL,
      displayName: 'Nader Samadyan',
      avatarColor: '#0FB848',
    });
  });

  it('rejects an empty displayName', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { displayName: '' },
    });

    expect(res.statusCode).toBe(400);
    // body validation triggers before DB — no queued results consumed.
    expect(mockDb._results.length).toBe(0);
  });

  it('rejects unknown keys (strict schema)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { displayName: 'Valid', extra: 'not allowed' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      payload: { displayName: 'x' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when the user row was deleted after the JWT was issued', async () => {
    mockDb._pushResult([]); // update returns no rows

    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { displayName: 'x' },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'NOT_FOUND' });
  });

  it('rejects displayName over 64 chars', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { displayName: 'x'.repeat(65) },
    });

    expect(res.statusCode).toBe(400);
  });
});
