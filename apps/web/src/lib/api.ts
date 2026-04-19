const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  query?: Record<string, string | number | undefined>;
};

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, query } = opts;

  const url = new URL(path, API_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {};
  // Don't set content-type for FormData — the browser sets it with the
  // boundary parameter the multipart parser needs.
  if (body !== undefined && !isFormData) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      if (data.error) code = data.error;
      if (data.message) message = data.message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
