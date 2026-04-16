import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from './api';

const mockFetch = vi.fn();

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes a GET request with the correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    });

    await apiFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url.toString()).toContain('/api/test');
    expect(init.method).toBe('GET');
  });

  it('sends POST with body and content-type header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
    });

    await apiFetch('/api/test', { method: 'POST', body: { name: 'hello' } });

    const [, init] = mockFetch.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'hello' }));
  });

  it('sets Authorization header when token is provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await apiFetch('/api/test', { token: 'my-token' });

    const [, init] = mockFetch.mock.calls[0]!;
    expect(init.headers.authorization).toBe('Bearer my-token');
  });

  it('appends query params and skips undefined values', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await apiFetch('/api/test', { query: { page: 1, filter: 'active', missing: undefined } });

    const [url] = mockFetch.mock.calls[0]!;
    const parsed = new URL(url.toString());
    expect(parsed.searchParams.get('page')).toBe('1');
    expect(parsed.searchParams.get('filter')).toBe('active');
    expect(parsed.searchParams.has('missing')).toBe(false);
  });

  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 42, name: 'test' }),
    });

    const result = await apiFetch<{ id: number; name: string }>('/api/test');
    expect(result).toEqual({ id: 42, name: 'test' });
  });

  it('returns undefined for 204 responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await apiFetch('/api/test', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws ApiError on error response with parseable body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: 'VALIDATION_ERROR', message: 'Invalid input' }),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow(ApiError);

    try {
      await apiFetch('/api/test');
    } catch (err) {
      // Need a fresh mock for the second call
    }

    // Re-mock and re-test to inspect properties
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: 'VALIDATION_ERROR', message: 'Invalid input' }),
    });

    try {
      await apiFetch('/api/test');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.message).toBe('Invalid input');
    }
  });

  it('throws ApiError with statusText when body is unparseable', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });

    try {
      await apiFetch('/api/test');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.code).toBe('HTTP_ERROR');
      expect(apiErr.message).toBe('Internal Server Error');
    }
  });

  it('ApiError is an instance of Error with correct properties', () => {
    const err = new ApiError(404, 'NOT_FOUND', 'Resource not found');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
  });
});
