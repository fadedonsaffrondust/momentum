import { describe, it, expect, vi } from 'vitest';
import type { JarvisLogger } from '../tools/types.ts';
import type { ToolCallRecord } from '../orchestrator.ts';
import { logJarvisTurn } from './logger.ts';

function makeLogger(): JarvisLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

const BASE_INPUT = {
  conversationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  userId: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
  intent: null,
  totalLatencyMs: 1234,
  tokenUsage: {
    inputTokens: 100,
    outputTokens: 50,
    cacheReadInputTokens: 200,
    cacheCreationInputTokens: 0,
  },
  model: 'claude-sonnet-4-6',
};

const SUCCESS_TOOL_CALLS: ToolCallRecord[] = [
  { name: 'getMyTasks', input: {}, result: [], error: null, latencyMs: 12 },
  { name: 'getBrand', input: {}, result: null, error: 'bad id', latencyMs: 5 },
];

describe('logJarvisTurn', () => {
  it('emits at info level on success with the spec §9 log shape', () => {
    const logger = makeLogger();
    const log = logJarvisTurn(logger, {
      ...BASE_INPUT,
      toolCalls: SUCCESS_TOOL_CALLS,
      status: 'success',
    });

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(log, 'jarvis turn completed');

    expect(log).toMatchObject({
      conversationId: BASE_INPUT.conversationId,
      userId: BASE_INPUT.userId,
      intent: null,
      totalLatencyMs: 1234,
      model: 'claude-sonnet-4-6',
      status: 'success',
    });
    expect(log.toolCalls).toEqual([
      { name: 'getMyTasks', latencyMs: 12, success: true },
      { name: 'getBrand', latencyMs: 5, success: false },
    ]);
    expect(log.costEstimateUsd).toBeGreaterThan(0);
    expect(log.error).toBeUndefined();
  });

  it('emits at error level with status=error and a serialized Error', () => {
    const logger = makeLogger();
    const err = new TypeError('bad things');
    logJarvisTurn(logger, {
      ...BASE_INPUT,
      toolCalls: [],
      status: 'error',
      error: err,
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    const payload = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      status: string;
      error: string;
    };
    expect(payload.status).toBe('error');
    expect(payload.error).toBe('TypeError: bad things');
  });

  it('status=timeout also emits at error level', () => {
    const logger = makeLogger();
    logJarvisTurn(logger, {
      ...BASE_INPUT,
      toolCalls: [],
      status: 'timeout',
      error: new Error('Jarvis turn exceeded 30000ms'),
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'timeout' }),
      'jarvis turn failed',
    );
  });

  it('normalizes an empty model id to "unknown"', () => {
    const logger = makeLogger();
    const log = logJarvisTurn(logger, {
      ...BASE_INPUT,
      model: '',
      toolCalls: [],
      status: 'error',
      error: new Error('pre-loop failure'),
    });
    expect(log.model).toBe('unknown');
  });

  it('serializes non-Error error values to String()', () => {
    const logger = makeLogger();
    const log = logJarvisTurn(logger, {
      ...BASE_INPUT,
      toolCalls: [],
      status: 'error',
      error: 'plain string error',
    });
    expect(log.error).toBe('plain string error');
  });

  it('omits the error field on success', () => {
    const logger = makeLogger();
    const log = logJarvisTurn(logger, {
      ...BASE_INPUT,
      toolCalls: [],
      status: 'success',
    });
    expect(log.error).toBeUndefined();
  });
});
