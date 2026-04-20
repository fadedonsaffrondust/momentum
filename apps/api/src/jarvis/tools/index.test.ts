import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { Database } from '@momentum/db';
import {
  ToolRegistry,
  createDefaultRegistry,
  ToolNotFoundError,
  ToolTimeoutError,
  ToolExecutionError,
  TOOL_TIMEOUT_MS,
  type Tool,
  type ToolContext,
  type JarvisLogger,
} from './index.ts';

function makeLogger(): JarvisLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    userId: '00000000-0000-0000-0000-000000000001',
    now: new Date('2026-04-19T12:00:00.000Z'),
    db: {} as unknown as Database,
    logger: makeLogger(),
    ...overrides,
  };
}

const echoTool: Tool<{ value: string }, { value: string }> = {
  name: 'echo',
  description: 'Echo the value back.',
  inputSchema: z.object({ value: z.string() }),
  readOnly: true,
  async handler(args) {
    return { value: args.value };
  },
};

describe('ToolRegistry', () => {
  it('registers and retrieves tools by name', () => {
    const registry = new ToolRegistry();
    registry.registerTool(echoTool);
    expect(registry.getTool('echo')).toBe(echoTool);
    expect(registry.getAllTools()).toEqual([echoTool]);
  });

  it('rejects duplicate registrations under the same name', () => {
    const registry = new ToolRegistry();
    registry.registerTool(echoTool);
    expect(() => registry.registerTool(echoTool)).toThrow(/already registered/i);
  });

  it('executeTool runs the handler and returns its result', async () => {
    const registry = new ToolRegistry();
    registry.registerTool(echoTool);
    const result = await registry.executeTool('echo', { value: 'hello' }, makeCtx());
    expect(result).toEqual({ value: 'hello' });
  });

  it('executeTool throws ToolNotFoundError for unknown tools', async () => {
    const registry = new ToolRegistry();
    await expect(registry.executeTool('nope', {}, makeCtx())).rejects.toBeInstanceOf(
      ToolNotFoundError,
    );
  });

  it('executeTool wraps Zod parse failures in ToolExecutionError', async () => {
    const registry = new ToolRegistry();
    registry.registerTool(echoTool);
    await expect(registry.executeTool('echo', { value: 42 }, makeCtx())).rejects.toBeInstanceOf(
      ToolExecutionError,
    );
  });

  it('executeTool wraps handler throws in ToolExecutionError and preserves the cause', async () => {
    const boom: Tool<Record<string, never>, never> = {
      name: 'boom',
      description: 'Always fails.',
      inputSchema: z.object({}),
      readOnly: true,
      async handler() {
        throw new Error('kaboom');
      },
    };
    const registry = new ToolRegistry();
    registry.registerTool(boom);
    try {
      await registry.executeTool('boom', {}, makeCtx());
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ToolExecutionError);
      const ex = err as ToolExecutionError;
      expect(ex.toolName).toBe('boom');
      expect((ex.toolCause as Error)?.message).toBe('kaboom');
    }
  });

  it('logs at info on success and error on failure', async () => {
    const registry = new ToolRegistry();
    registry.registerTool(echoTool);
    const logger = makeLogger();
    await registry.executeTool('echo', { value: 'x' }, makeCtx({ logger }));
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'echo' }),
      'jarvis tool executed',
    );

    await expect(registry.executeTool('missing', {}, makeCtx({ logger }))).rejects.toThrow();
    // Logger may or may not be called for "not found"; the important guarantee
    // is that a failed handler logs at error — exercised in the timeout test.
  });
});

describe('ToolRegistry — timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws ToolTimeoutError when the handler exceeds TOOL_TIMEOUT_MS', async () => {
    const neverResolves: Tool<Record<string, never>, never> = {
      name: 'slow',
      description: 'Never resolves.',
      inputSchema: z.object({}),
      readOnly: true,
      handler() {
        // Promise that never settles — the timeout must win.
        return new Promise(() => {});
      },
    };
    const registry = new ToolRegistry();
    registry.registerTool(neverResolves);
    const logger = makeLogger();

    const promise = registry.executeTool('slow', {}, makeCtx({ logger }));
    // Attach rejection handler before advancing timers so Node never sees
    // an unhandled rejection.
    const assertion = expect(promise).rejects.toBeInstanceOf(ToolTimeoutError);
    await vi.advanceTimersByTimeAsync(TOOL_TIMEOUT_MS + 1);
    await assertion;
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'slow' }),
      'jarvis tool timed out',
    );
  });
});

describe('createDefaultRegistry', () => {
  it('registers the three V1 tools', () => {
    const registry = createDefaultRegistry();
    const names = registry
      .getAllTools()
      .map((t) => t.name)
      .sort();
    expect(names).toEqual(['getBrand', 'getBrandsRequiringAttention', 'getMyTasks']);
  });

  it('every registered tool is read-only', () => {
    const registry = createDefaultRegistry();
    for (const tool of registry.getAllTools()) {
      expect(tool.readOnly).toBe(true);
    }
  });
});
