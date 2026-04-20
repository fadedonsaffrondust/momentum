import { describe, it, expect, vi } from 'vitest';
import type { JarvisStreamEvent } from '@momentum/shared';
import { readSse } from './streamMessage';

/**
 * readSse owns the SSE framing logic; exercise it against hand-crafted
 * ReadableStreams so the parser is verified independent of fetch.
 */

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]!));
      i += 1;
    },
  });
}

function formatEvent(event: JarvisStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

describe('readSse', () => {
  it('parses a single event block', async () => {
    const stream = makeStream([formatEvent({ type: 'intent', intent: '' })]);
    const events: JarvisStreamEvent[] = [];
    await readSse(stream, (e) => events.push(e));
    expect(events).toEqual([{ type: 'intent', intent: '' }]);
  });

  it('parses multiple blocks arriving in one chunk', async () => {
    const blob =
      formatEvent({ type: 'intent', intent: '' }) +
      formatEvent({ type: 'text_delta', text: 'hello' });
    const stream = makeStream([blob]);
    const events: JarvisStreamEvent[] = [];
    await readSse(stream, (e) => events.push(e));
    expect(events).toEqual([
      { type: 'intent', intent: '' },
      { type: 'text_delta', text: 'hello' },
    ]);
  });

  it('reassembles an event split across chunks', async () => {
    const raw = formatEvent({ type: 'text_delta', text: 'hello world' });
    const mid = Math.floor(raw.length / 2);
    const stream = makeStream([raw.slice(0, mid), raw.slice(mid)]);
    const events: JarvisStreamEvent[] = [];
    await readSse(stream, (e) => events.push(e));
    expect(events).toEqual([{ type: 'text_delta', text: 'hello world' }]);
  });

  it('skips `:keepalive` comment lines', async () => {
    const stream = makeStream([':keepalive\n\n', formatEvent({ type: 'text_delta', text: 'hi' })]);
    const events: JarvisStreamEvent[] = [];
    await readSse(stream, (e) => events.push(e));
    expect(events).toEqual([{ type: 'text_delta', text: 'hi' }]);
  });

  it('drops events whose data fails Zod validation', async () => {
    const stream = makeStream([
      'event: unknown_type\ndata: {"type":"unknown_type","foo":1}\n\n',
      formatEvent({ type: 'text_delta', text: 'hi' }),
    ]);
    const events: JarvisStreamEvent[] = [];
    await readSse(stream, (e) => events.push(e));
    expect(events).toEqual([{ type: 'text_delta', text: 'hi' }]);
  });

  it('aborts cleanly via the AbortSignal', async () => {
    // A stream that never closes until we cancel it. We assert readSse
    // returns (doesn't hang) after we abort.
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        /* never enqueue, never close */
      },
    });
    const ac = new AbortController();
    const onEvent = vi.fn();
    const promise = readSse(stream, onEvent, ac.signal);
    ac.abort();
    await expect(promise).resolves.toBeUndefined();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('handles a done event with full payload', async () => {
    const done: JarvisStreamEvent = {
      type: 'done',
      messageId: 'msg-1',
      totalLatencyMs: 150,
      tokenUsage: {
        inputTokens: 10,
        outputTokens: 5,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
      stopReason: 'end_turn',
    };
    const stream = makeStream([formatEvent(done)]);
    const events: JarvisStreamEvent[] = [];
    await readSse(stream, (e) => events.push(e));
    expect(events).toEqual([done]);
  });
});
