import { jarvisStreamEventSchema, type JarvisStreamEvent } from '@momentum/shared';

/**
 * Fetch-based SSE reader for `POST /api/jarvis/conversations/:id/messages`.
 *
 * EventSource can't attach an `Authorization` header, and Momentum uses
 * Bearer tokens — a fetch-stream is the right primitive. We parse the
 * SSE framing by hand because the endpoint is the only streaming one in
 * the app; pulling in a dedicated SSE library would be overkill.
 *
 * SSE framing: each event is a block of lines separated by `\n`, blocks
 * separated by `\n\n`. Lines we care about:
 *   - `event: <type>` — ignored (the JSON payload carries `type` too)
 *   - `data: <json>`  — the event payload
 *   - `: <comment>`   — keepalive ping, skip
 *
 * Multi-line `data:` is technically legal (browsers concat with `\n`)
 * but we never emit it, so we only support the single-line shape.
 */

export interface StreamMessageOptions {
  conversationId: string;
  content: string;
  token: string | null;
  /** Invoked for every parsed SSE event. */
  onEvent: (event: JarvisStreamEvent) => void;
  /** Optional abort signal; cancels the fetch AND the reader. */
  signal?: AbortSignal;
  /** Override — tests point at a mock. Defaults to VITE_API_URL. */
  baseUrl?: string;
}

const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class StreamMessageError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'StreamMessageError';
    this.status = status;
  }
}

export async function streamMessage(opts: StreamMessageOptions): Promise<void> {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const url = new URL(`/api/jarvis/conversations/${opts.conversationId}/messages`, baseUrl);

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'text/event-stream',
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: opts.content }),
    signal: opts.signal,
  });

  if (!response.ok) {
    // Body is usually a small JSON error envelope ({ message, error }).
    // Read it for a useful message, fall back to statusText.
    const text = await response.text().catch(() => '');
    let message = response.statusText || `HTTP ${response.status}`;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string; error?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        message = text;
      }
    }
    throw new StreamMessageError(response.status, message);
  }

  if (!response.body) {
    throw new StreamMessageError(0, 'SSE response had no body');
  }

  await readSse(response.body, opts.onEvent, opts.signal);
}

/**
 * Drain the ReadableStream, split into SSE event blocks, and forward
 * parsed JSON payloads to `onEvent`. Exported for unit testing —
 * pass in any ReadableStream<Uint8Array> to exercise parsing in
 * isolation from fetch.
 */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: JarvisStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const abortHandler = () => {
    // Cancelling the reader reject any pending .read() — the read loop
    // below catches the abort and exits.
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // An SSE event is terminated by a blank line (\n\n). Multiple
      // events can arrive in a single chunk; split them out.
      let terminator = buffer.indexOf('\n\n');
      while (terminator !== -1) {
        const rawBlock = buffer.slice(0, terminator);
        buffer = buffer.slice(terminator + 2);
        const event = parseSseBlock(rawBlock);
        if (event) onEvent(event);
        terminator = buffer.indexOf('\n\n');
      }
    }
  } finally {
    signal?.removeEventListener('abort', abortHandler);
  }
}

function parseSseBlock(block: string): JarvisStreamEvent | null {
  let data = '';
  for (const line of block.split('\n')) {
    // Comments (keepalive pings) start with ':' — ignore.
    if (line.startsWith(':')) continue;
    // We only care about `data:` lines; the `event:` header is
    // duplicated in the JSON payload's `type` field so there's no
    // information loss.
    if (line.startsWith('data:')) {
      // The leading space after `:` is optional per the spec but
      // the server emits it — trim it off.
      data += line.slice(5).replace(/^\s/, '');
    }
  }
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as unknown;
    const result = jarvisStreamEventSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
