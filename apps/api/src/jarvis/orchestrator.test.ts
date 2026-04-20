import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { Database } from '@momentum/db';
import { createMockDb } from '../test/mock-db.ts';
import {
  ToolRegistry,
  createDefaultRegistry,
  type JarvisLogger,
  type Tool,
} from './tools/index.ts';
import {
  JarvisService,
  TurnTimeoutError,
  extractAssistantText,
  toolToAnthropic,
} from './orchestrator.ts';
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMContentBlock,
  LLMUsage,
} from './llm-provider.ts';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const NOW = new Date('2026-04-19T12:00:00.000Z');

function makeLogger(): JarvisLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function textBlock(text: string): LLMContentBlock {
  return { type: 'text', text, citations: null } as unknown as LLMContentBlock;
}

function toolUseBlock(id: string, name: string, input: unknown): LLMContentBlock {
  return { type: 'tool_use', id, name, input } as unknown as LLMContentBlock;
}

function usage(overrides: Partial<LLMUsage> = {}): LLMUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    ...overrides,
  };
}

function llmResponse(
  stopReason: LLMResponse['stopReason'],
  content: LLMContentBlock[],
  overrides: Partial<Omit<LLMResponse, 'stopReason' | 'content'>> = {},
): LLMResponse {
  return {
    id: 'msg_test',
    model: 'claude-sonnet-4-6',
    stopReason,
    content,
    usage: usage(),
    ...overrides,
  };
}

function makeMockLLM(responses: LLMResponse[]): LLMProvider & {
  sendMessage: ReturnType<typeof vi.fn>;
} {
  const fn = vi.fn<(req: LLMRequest) => Promise<LLMResponse>>();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return { sendMessage: fn } as LLMProvider & { sendMessage: ReturnType<typeof vi.fn> };
}

/* ─────────────── happy path: two-tool-call flow ─────────────── */

describe('JarvisService.handleMessage — happy path', () => {
  it('runs a two-tool-call turn, then returns the end_turn answer', async () => {
    const mockDb = createMockDb();
    // Tool queries, in the order the orchestrator will consume them:
    // 1) getMyTasks — 1 query
    mockDb._pushResult([
      {
        id: '11111111-1111-1111-1111-111111111111',
        creatorId: USER_ID,
        assigneeId: USER_ID,
        title: 'Ship Jarvis Task 4',
        roleId: null,
        priority: 'high',
        estimateMinutes: 120,
        actualMinutes: null,
        status: 'in_progress',
        column: 'in_progress',
        scheduledDate: '2026-04-19',
        createdAt: new Date('2026-04-18T09:00:00.000Z'),
        startedAt: new Date('2026-04-19T10:00:00.000Z'),
        completedAt: null,
      },
    ]);
    // 2) getBrandsRequiringAttention — 4 queries in Promise.all order
    mockDb._pushResult([
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Risky', status: 'active' },
    ]);
    mockDb._pushResult([
      {
        brandId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        openCount: 3,
        overdueCount: 1,
      },
    ]);
    mockDb._pushResult([
      { brandId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', lastDate: '2026-04-05' },
    ]);
    mockDb._pushResult([
      {
        brandId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        lastCreatedAt: new Date('2026-04-05T12:00:00.000Z'),
      },
    ]);

    const mockLLM = makeMockLLM([
      // Turn 1 — parallel tool calls
      llmResponse(
        'tool_use',
        [
          toolUseBlock('tu_1', 'getMyTasks', { limit: 5 }),
          toolUseBlock('tu_2', 'getBrandsRequiringAttention', { limit: 10 }),
        ],
        { usage: usage({ inputTokens: 100, outputTokens: 80 }) },
      ),
      // Turn 2 — LLM has both results, produces final text
      llmResponse('end_turn', [textBlock('You have 1 task today and **Risky** needs attention.')], {
        usage: usage({ inputTokens: 150, outputTokens: 40 }),
      }),
    ]);

    const service = new JarvisService({
      llm: mockLLM,
      registry: createDefaultRegistry(),
      db: mockDb as unknown as Database,
      now: () => NOW,
    });

    const result = await service.handleMessage({
      userId: USER_ID,
      userMessage: 'What do I need to look at today?',
      logger: makeLogger(),
    });

    expect(result.loopExhausted).toBe(false);
    expect(result.stopReason).toBe('end_turn');
    expect(result.assistantText).toBe('You have 1 task today and **Risky** needs attention.');
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]).toMatchObject({ name: 'getMyTasks', error: null });
    expect(result.toolCalls[1]).toMatchObject({
      name: 'getBrandsRequiringAttention',
      error: null,
    });
    // Summed usage across both LLM calls
    expect(result.usage.inputTokens).toBe(250);
    expect(result.usage.outputTokens).toBe(120);

    // The orchestrator forwards the system prompt and tool definitions on
    // every turn, and carries history forward.
    expect(mockLLM.sendMessage).toHaveBeenCalledTimes(2);
    const firstCall = mockLLM.sendMessage.mock.calls[0]![0] as LLMRequest;
    expect(firstCall.system).toMatch(/You are Jarvis/);
    expect(firstCall.tools.length).toBeGreaterThanOrEqual(3);
    expect(firstCall.messages).toEqual([
      { role: 'user', content: 'What do I need to look at today?' },
    ]);

    const secondCall = mockLLM.sendMessage.mock.calls[1]![0] as LLMRequest;
    // user message → assistant tool_use → user tool_result
    expect(secondCall.messages).toHaveLength(3);
    expect(secondCall.messages[1]!.role).toBe('assistant');
    expect(secondCall.messages[2]!.role).toBe('user');
  });
});

/* ─────────────── tool error surfaces as is_error tool_result ─────────────── */

describe('JarvisService.handleMessage — tool failures', () => {
  it('surfaces a failing tool as an is_error tool_result without aborting the turn', async () => {
    // Use a custom minimal registry so the failure mode is obvious.
    const registry = new ToolRegistry();
    const failingTool: Tool<{ x: number }, { ok: true }> = {
      name: 'failingTool',
      description: 'Always fails.',
      inputSchema: z.object({ x: z.number() }),
      readOnly: true,
      async handler() {
        throw new Error('synthetic failure');
      },
    };
    registry.registerTool(failingTool);

    const mockLLM = makeMockLLM([
      llmResponse('tool_use', [toolUseBlock('tu_1', 'failingTool', { x: 1 })]),
      llmResponse('end_turn', [textBlock('Sorry — that lookup failed.')]),
    ]);

    const service = new JarvisService({
      llm: mockLLM,
      registry,
      db: createMockDb() as unknown as Database,
      now: () => NOW,
    });

    const result = await service.handleMessage({
      userId: USER_ID,
      userMessage: 'try it',
      logger: makeLogger(),
    });

    expect(result.loopExhausted).toBe(false);
    expect(result.toolCalls[0]!.error).toMatch(/synthetic failure/);
    // The second LLM call receives an is_error tool_result block.
    const secondReq = mockLLM.sendMessage.mock.calls[1]![0] as LLMRequest;
    const lastMsg = secondReq.messages[secondReq.messages.length - 1]!;
    expect(lastMsg.role).toBe('user');
    const toolResultBlocks = (lastMsg.content as unknown[]).filter(
      (b): b is { type: 'tool_result'; is_error?: boolean } =>
        typeof b === 'object' && b !== null && (b as { type?: string }).type === 'tool_result',
    );
    expect(toolResultBlocks).toHaveLength(1);
    expect(toolResultBlocks[0]!.is_error).toBe(true);
  });
});

/* ─────────────── loop exhaustion ─────────────── */

describe('JarvisService.handleMessage — loop exhaustion', () => {
  it('cuts off after toolLoopMax calls and returns the fallback reply', async () => {
    const registry = new ToolRegistry();
    registry.registerTool({
      name: 'noop',
      description: 'Does nothing.',
      inputSchema: z.object({}),
      readOnly: true,
      async handler() {
        return { ok: true };
      },
    });

    // LLM will return tool_use indefinitely.
    const sendMessage = vi
      .fn<(req: LLMRequest) => Promise<LLMResponse>>()
      .mockImplementation(async () =>
        llmResponse('tool_use', [toolUseBlock(`tu_${Math.random()}`, 'noop', {})]),
      );
    const mockLLM: LLMProvider = { sendMessage };

    const logger = makeLogger();
    const service = new JarvisService({
      llm: mockLLM,
      registry,
      db: createMockDb() as unknown as Database,
      now: () => NOW,
      toolLoopMax: 3,
    });

    const result = await service.handleMessage({
      userId: USER_ID,
      userMessage: 'loop forever',
      logger,
    });

    expect(result.loopExhausted).toBe(true);
    expect(result.stopReason).toBe('tool_loop_exhausted');
    expect(result.toolCalls).toHaveLength(3);
    expect(result.assistantText).toMatch(/rephrase/i);
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ toolLoopMax: 3 }),
      'jarvis tool loop exhausted',
    );
  });
});

/* ─────────────── turn timeout ─────────────── */

describe('JarvisService.handleMessage — turn timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('throws TurnTimeoutError when the LLM hangs past turnTimeoutMs', async () => {
    const mockLLM: LLMProvider = {
      // Never resolves.
      sendMessage: () => new Promise(() => {}),
    };

    const service = new JarvisService({
      llm: mockLLM,
      registry: new ToolRegistry(),
      db: createMockDb() as unknown as Database,
      now: () => NOW,
      turnTimeoutMs: 1000,
    });

    const promise = service.handleMessage({
      userId: USER_ID,
      userMessage: 'slow',
      logger: makeLogger(),
    });
    const assertion = expect(promise).rejects.toBeInstanceOf(TurnTimeoutError);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });
});

/* ─────────────── unexpected stop_reason (e.g. max_tokens) ─────────────── */

describe('JarvisService.handleMessage — unexpected stop_reason', () => {
  it('returns whatever the LLM produced when it stops without tool_use and without end_turn', async () => {
    const mockLLM = makeMockLLM([
      llmResponse('max_tokens', [textBlock('I ran out of space mid-answer')]),
    ]);

    const service = new JarvisService({
      llm: mockLLM,
      registry: new ToolRegistry(),
      db: createMockDb() as unknown as Database,
      now: () => NOW,
    });

    const result = await service.handleMessage({
      userId: USER_ID,
      userMessage: 'anything',
      logger: makeLogger(),
    });
    expect(result.loopExhausted).toBe(false);
    expect(result.stopReason).toBe('max_tokens');
    expect(result.assistantText).toBe('I ran out of space mid-answer');
  });
});

/* ─────────────── helpers ─────────────── */

describe('toolToAnthropic', () => {
  it('converts a real V1 tool to an Anthropic-shaped tool definition', () => {
    const registry = createDefaultRegistry();
    const getBrand = registry.getTool('getBrand')!;
    const anth = toolToAnthropic(getBrand);
    expect(anth.name).toBe('getBrand');
    expect(anth.description).toBe(getBrand.description);
    expect(anth.input_schema.type).toBe('object');
    expect(anth.input_schema.properties).toHaveProperty('brandId');
    expect(anth.input_schema.required).toEqual(['brandId']);
  });

  it('strips $schema and additionalProperties from the converted schema', () => {
    const registry = createDefaultRegistry();
    const anth = toolToAnthropic(registry.getTool('getMyTasks')!);
    expect(anth.input_schema).not.toHaveProperty('$schema');
    expect(anth.input_schema).not.toHaveProperty('additionalProperties');
  });
});

describe('extractAssistantText', () => {
  it('concatenates text blocks and trims', () => {
    const content = [textBlock('line one'), textBlock('line two')];
    expect(extractAssistantText(content)).toBe('line one\nline two');
  });

  it('ignores non-text blocks', () => {
    const content = [textBlock('hello'), toolUseBlock('tu_1', 'x', {})];
    expect(extractAssistantText(content)).toBe('hello');
  });
});
