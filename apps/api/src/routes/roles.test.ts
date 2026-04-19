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
import { rolesRoutes } from './roles.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ROLE_ID = 'c1234567-1234-1234-1234-123456789012';

function makeRoleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ROLE_ID,
    userId: USER_ID,
    name: 'Engineering',
    color: '#0FB848',
    position: 0,
    ...overrides,
  };
}

describe('roles routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(errorHandlerPlugin);
    await app.register(authPlugin);
    await app.register(rolesRoutes);
    await app.ready();
    token = app.jwt.sign({ sub: USER_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    mockDb._results.length = 0;
  });

  // ── POST /roles ────────────────────────────────────────────────────

  it('POST /roles assigns palette color 0 for first role (no color given)', async () => {
    mockDb._pushResult([]); // duplicate-name check: none
    mockDb._pushResult([{ maxPos: null }]); // no existing roles
    mockDb._pushResult([makeRoleRow({ position: 0, color: '#0FB848' })]);

    const res = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Engineering' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.color).toBe('#0FB848');
    expect(body.position).toBe(0);
  });

  it('POST /roles assigns palette color 3 for 4th role (no color given)', async () => {
    mockDb._pushResult([]); // duplicate-name check: none
    mockDb._pushResult([{ maxPos: 2 }]); // 3 existing roles, maxPos=2
    mockDb._pushResult([makeRoleRow({ position: 3, color: '#F76C6C' })]);

    const res = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Design' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.color).toBe('#F76C6C');
    expect(body.position).toBe(3);
  });

  it('POST /roles uses explicit color when provided', async () => {
    mockDb._pushResult([]); // duplicate-name check: none
    mockDb._pushResult([{ maxPos: 0 }]);
    mockDb._pushResult([makeRoleRow({ position: 1, color: '#112233' })]);

    const res = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Custom', color: '#112233' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).color).toBe('#112233');
  });

  it('POST /roles wraps palette for 9th role', async () => {
    mockDb._pushResult([]); // duplicate-name check: none
    mockDb._pushResult([{ maxPos: 7 }]); // 8 existing, maxPos=7
    mockDb._pushResult([makeRoleRow({ position: 8, color: '#0FB848' })]);

    const res = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Wrapped' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // nextPosition=8, 8 % 8 = 0 => palette[0] = '#0FB848' (brand green)
    expect(body.color).toBe('#0FB848');
    expect(body.position).toBe(8);
  });

  it('POST /roles returns 409 when a role with the same name (case-insensitive) exists', async () => {
    mockDb._pushResult([{ name: 'Product' }]); // duplicate-name check hits

    const res = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'product' }, // lowercase should still collide with 'Product'
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('CONFLICT');
    expect(body.message).toContain('Product');
  });

  // ── PATCH /roles/:id ───────────────────────────────────────────────

  it('PATCH /roles/:id returns 409 when renaming to a name that already exists', async () => {
    mockDb._pushResult([{ name: 'Design' }]); // dup check hits

    const res = await app.inject({
      method: 'PATCH',
      url: `/roles/${ROLE_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'design' }, // case-insensitive collision
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toBe('CONFLICT');
  });

  it('PATCH /roles/:id allows rename when no conflict', async () => {
    mockDb._pushResult([]); // dup check empty
    mockDb._pushResult([makeRoleRow({ name: 'Renamed' })]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/roles/${ROLE_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Renamed' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).name).toBe('Renamed');
  });

  it('PATCH /roles/:id skips dup check when body has no name', async () => {
    mockDb._pushResult([makeRoleRow({ color: '#112233' })]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/roles/${ROLE_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { color: '#112233' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).color).toBe('#112233');
  });

  it('PATCH /roles/:id returns 404 when role not found', async () => {
    mockDb._pushResult([]); // update returning empty

    const res = await app.inject({
      method: 'PATCH',
      url: `/roles/${ROLE_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { color: '#112233' },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── DELETE /roles/:id ──────────────────────────────────────────────

  it('DELETE /roles/:id returns 404 when role not found', async () => {
    mockDb._pushResult([]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/roles/${ROLE_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('DELETE /roles/:id returns ok on success', async () => {
    mockDb._pushResult([{ id: ROLE_ID }]);

    const res = await app.inject({
      method: 'DELETE',
      url: `/roles/${ROLE_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });
});
