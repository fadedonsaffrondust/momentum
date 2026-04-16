import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError, z } from 'zod';
import { errorHandlerPlugin } from './error-handler.js';
import { AppError } from '../errors.js';

describe('errorHandlerPlugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(errorHandlerPlugin);

    app.get('/throw-zod', async () => {
      throw new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
      ]);
    });

    app.get('/throw-app-error', async () => {
      throw new AppError(403, 'FORBIDDEN', 'nope');
    });

    app.get('/throw-not-found', async () => {
      throw new AppError(404, 'NOT_FOUND', 'Resource not found');
    });

    app.get('/throw-generic', async () => {
      throw new Error('boom');
    });

    await app.ready();
  });

  afterAll(() => app.close());

  it('returns 400 VALIDATION_ERROR for ZodError', async () => {
    const res = await app.inject({ method: 'GET', url: '/throw-zod' });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Request validation failed');
    expect(body.details).toBeDefined();
  });

  it('returns correct status and code for AppError (403)', async () => {
    const res = await app.inject({ method: 'GET', url: '/throw-app-error' });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe('FORBIDDEN');
    expect(body.message).toBe('nope');
  });

  it('returns correct status and code for AppError (404)', async () => {
    const res = await app.inject({ method: 'GET', url: '/throw-not-found' });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('Resource not found');
  });

  it('returns 500 INTERNAL_ERROR for unhandled errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/throw-generic' });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Something went wrong');
  });

  it('does not leak internal error details in 500 responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/throw-generic' });
    const body = res.json();

    expect(body.message).not.toContain('boom');
    expect(body).not.toHaveProperty('stack');
  });
});
