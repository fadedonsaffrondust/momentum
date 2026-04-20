import type { ServerResponse } from 'node:http';
import type { JarvisStreamEvent } from '@momentum/shared';

/**
 * Thin server-sent-events helpers. Kept deliberately small — Fastify has
 * no first-class SSE support and we don't need one for a single endpoint.
 * The route takes over the raw socket via `reply.hijack()` and hands it
 * to these helpers.
 *
 * SSE wire format per the spec (https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events):
 *   event: <name>\n
 *   data:  <json>\n
 *   \n
 *
 * We emit `event:` so the frontend can dispatch without parsing the JSON
 * up-front, and we keep each event's payload self-describing (the JSON
 * also carries `type`), so a client can filter either way.
 */

export interface SseHeaderOptions {
  /**
   * CORS origin to echo on the SSE response. Required when the SSE endpoint
   * is called cross-origin (every browser case for us — the web client runs
   * on 5173 while the API runs on 3001). `reply.hijack()` bypasses Fastify's
   * normal `onSend` pipeline, so the `@fastify/cors` plugin NEVER gets a
   * chance to add `Access-Control-Allow-Origin`. Without it, the browser
   * rejects the response with a `Failed to fetch` CORS error — even though
   * the preflight OPTIONS succeeded. Pass the request's `Origin` header here
   * so the response echoes it back.
   */
  origin?: string;
}

/**
 * Write the response headers SSE needs. Must be called before any event
 * write and before `reply.hijack()` is already active.
 */
export function writeSseHeaders(res: ServerResponse, opts: SseHeaderOptions = {}): void {
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disable nginx/other proxy buffering so the first token is visible
    // client-side immediately.
    'X-Accel-Buffering': 'no',
  };
  if (opts.origin) {
    headers['Access-Control-Allow-Origin'] = opts.origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers.Vary = 'Origin';
  }
  res.writeHead(200, headers);
}

/**
 * Write one SSE event. `event:` is set from the discriminated union's
 * `type` tag so browser EventSource handlers (or a fetch-stream reader
 * checking `event:` lines) can dispatch without parsing JSON.
 */
export function writeSseEvent(res: ServerResponse, event: JarvisStreamEvent): void {
  // Guard against whoever calls us post-hangup.
  if (res.destroyed || res.writableEnded) return;
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/** Flush end-of-stream. Idempotent. */
export function endSse(res: ServerResponse): void {
  if (res.destroyed || res.writableEnded) return;
  res.end();
}

/**
 * Start a keep-alive pinger that writes a comment line every
 * `intervalMs` to keep intermediaries from closing idle connections.
 * Returns a cleanup function; the caller MUST invoke it when the stream
 * ends or on client disconnect.
 */
export function startSseKeepAlive(res: ServerResponse, intervalMs = 15_000): () => void {
  const timer = setInterval(() => {
    if (res.destroyed || res.writableEnded) return;
    res.write(':keepalive\n\n');
  }, intervalMs);
  // Don't hold the event loop open just for pings.
  timer.unref?.();
  return () => clearInterval(timer);
}
