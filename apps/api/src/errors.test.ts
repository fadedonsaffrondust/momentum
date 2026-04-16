import { describe, it, expect } from 'vitest';
import { AppError, badRequest, unauthorized, notFound, conflict } from './errors.js';

describe('AppError', () => {
  it('extends Error', () => {
    const err = new AppError(500, 'INTERNAL', 'boom');
    expect(err).toBeInstanceOf(Error);
  });

  it('has statusCode, code, message, and name="AppError"', () => {
    const err = new AppError(422, 'UNPROCESSABLE', 'bad data');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('UNPROCESSABLE');
    expect(err.message).toBe('bad data');
    expect(err.name).toBe('AppError');
  });
});

describe('badRequest', () => {
  it('returns 400 BAD_REQUEST with custom message', () => {
    const err = badRequest('missing field');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('missing field');
  });
});

describe('unauthorized', () => {
  it('defaults to "Unauthorized"', () => {
    const err = unauthorized();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Unauthorized');
  });

  it('accepts a custom message', () => {
    const err = unauthorized('token expired');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('token expired');
  });
});

describe('notFound', () => {
  it('defaults to "Not found"', () => {
    const err = notFound();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Not found');
  });

  it('accepts a custom message', () => {
    const err = notFound('task not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('task not found');
  });
});

describe('conflict', () => {
  it('returns 409 CONFLICT with custom message', () => {
    const err = conflict('already exists');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('already exists');
  });
});
