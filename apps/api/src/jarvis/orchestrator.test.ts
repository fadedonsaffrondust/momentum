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
  dbMessageToAnthropic,
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
import type { JarvisPersistence } from './persistence/index.ts';
import type { MessageRow } from './persistence/messages.ts';
import type { ToolCallRow } from './persistence/tool-calls.ts';
import type { JarvisStreamEvent } from '@momentum/shared';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const CONVERSATION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
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
  streamMessage: ReturnType<typeof vi.fn>;
} {
  // Both sendMessage and streamMessage pull from the same response queue
  // so tests can exercise either path with a single `responses` array.
  const queue: LLMResponse[] = [...responses];
  const send = vi.fn(async (_req: LLMRequest): Promise<LLMResponse> => {
    const next = queue.shift();
    if (!next) throw new Error('mock LLM ran out of responses');
    return next;
  });
  const stream = vi.fn(
    async (
      _req: LLMRequest,
      opts: { onTextDelta: (text: string) => void },
    ): Promise<LLMResponse> => {
      const next = queue.shift();
      if (!next) throw new Error('mock LLM ran out of responses');
      // Forward the final text as a single delta so streaming consumers
      // get something to exercise. Real providers emit per-token deltas;
      // for tests, one delta per text block is enough to prove the wiring.
      for (const block of next.content) {
        if (block.type === 'text') opts.onTextDelta(block.text);
      }
      return next;
    },
  );
  return { sendMessage: send, streamMessage: stream };
}

/**
 * Mock persistence that auto-generates sequential ids so the orchestrator
 * can chain inserts (assistant message → tool_call FK) without any
 * per-test setup. Tests that care about specific IDs can override.
 */
interface MockPersistence extends JarvisPersistence {
  insertMessage: ReturnType<typeof vi.fn>;
  insertToolCall: ReturnType<typeof vi.fn>;
  listMessagesByConversation: ReturnType<typeof vi.fn>;
  bumpConversationUpdatedAt: ReturnType<typeof vi.fn>;
  getConversationForUser: ReturnType<typeof vi.fn>;
  loadActingUser: ReturnType<typeof vi.fn>;
  loadTeamRoster: ReturnType<typeof vi.fn>;
  loadBrandPortfolio: ReturnType<typeof vi.fn>;
}

function makeMockPersistence(
  overrides: {
    historyRows?: MessageRow[];
  } = {},
): MockPersistence {
  let msgSeq = 0;
  let tcSeq = 0;
  const history = overrides.historyRows ?? [];

  return {
    listMessagesByConversation: vi.fn(async () => history),
    insertMessage: vi.fn(async (input) => {
      msgSeq += 1;
      const row: MessageRow = {
        id: `msg-${msgSeq}`,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        intent: input.intent ?? null,
        model: input.model ?? null,
        latencyMs: input.latencyMs ?? null,
        tokenUsage: input.tokenUsage ?? null,
        error: input.error ?? null,
        createdAt: new Date(`2026-04-19T12:00:0${msgSeq}.000Z`),
        metadata: input.metadata ?? {},
      };
      history.push(row);
      return row;
    }),
    insertToolCall: vi.fn(async (input) => {
      tcSeq += 1;
      const row: ToolCallRow = {
        id: `tc-${tcSeq}`,
        messageId: input.messageId,
        toolName: input.toolName,
        arguments: input.arguments,
        result: input.result ?? null,
        error: input.error ?? null,
        latencyMs: input.latencyMs,
        createdAt: new Date('2026-04-19T12:00:00.000Z'),
        metadata: input.metadata ?? {},
      };
      return row;
    }),
    bumpConversationUpdatedAt: vi.fn(async () => undefined),
    getConversationForUser: vi.fn(async (id, userId) => ({ id, userId })),
    loadActingUser: vi.fn(async (userId: string) => ({
      id: userId,
      displayName: 'Test User',
    })),
    loadTeamRoster: vi.fn(async () => []),
    loadBrandPortfolio: vi.fn(async () => []),
  };
}

/* ─────────────── happy path: two-tool-call flow ─────────────── */

describe('JarvisService.handleMessage — happy path', () => {
  it('runs a two-tool-call turn, persists every message + tool_call, then returns end_turn text', async () => {
    const mockDb = createMockDb();
    // Tool queries, in the order the orchestrator will consume them:
    // 1) getMyTasks — 1 query
    mockDb._pushResult([
      {
        id: '11111111-1111-1111-1111-111111111111',
        creatorId: USER_ID,
        assigneeId: USER_ID,
        title: 'Ship Jarvis Task 5',
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
      llmResponse(
        'tool_use',
        [
          toolUseBlock('tu_1', 'getMyTasks', { limit: 5 }),
          toolUseBlock('tu_2', 'getBrandsRequiringAttention', { limit: 10 }),
        ],
        { usage: usage({ inputTokens: 100, outputTokens: 80 }) },
      ),
      llmResponse('end_turn', [textBlock('You have 1 task today and **Risky** needs attention.')], {
        usage: usage({ inputTokens: 150, outputTokens: 40 }),
      }),
    ]);

    const persistence = makeMockPersistence();

    const service = new JarvisService({
      llm: mockLLM,
      registry: createDefaultRegistry(),
      db: mockDb as unknown as Database,
      persistence,
      now: () => NOW,
    });

    const result = await service.handleMessage({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      userMessage: 'What do I need to look at today?',
      logger: makeLogger(),
    });

    expect(result.loopExhausted).toBe(false);
    expect(result.stopReason).toBe('end_turn');
    expect(result.assistantText).toBe('You have 1 task today and **Risky** needs attention.');

    // Persistence: user → assistant (turn 1) → tool-results → assistant (turn 2)
    const inserted = persistence.insertMessage.mock.calls.map(
      (c) => c[0] as { role: string; error?: unknown },
    );
    expect(inserted.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(inserted[0]).toMatchObject({
      conversationId: CONVERSATION_ID,
      role: 'user',
      content: [{ type: 'text', text: 'What do I need to look at today?' }],
    });
    expect(inserted[1]).toMatchObject({
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      tokenUsage: expect.objectContaining({ inputTokens: 100 }),
    });
    expect(inserted[3]).toMatchObject({
      role: 'assistant',
      tokenUsage: expect.objectContaining({ inputTokens: 150 }),
    });
    // No error markers on a successful turn
    for (const m of inserted) expect(m.error ?? null).toBeNull();

    // Both tool calls persisted, both linked to the turn-1 assistant message
    expect(persistence.insertToolCall).toHaveBeenCalledTimes(2);
    const tcCalls = persistence.insertToolCall.mock.calls.map((c) => c[0]);
    expect(tcCalls[0]).toMatchObject({
      messageId: 'msg-2', // turn-1 assistant (msg-1 = user message)
      toolName: 'getMyTasks',
      error: null,
    });
    expect(tcCalls[1]).toMatchObject({
      messageId: 'msg-2',
      toolName: 'getBrandsRequiringAttention',
      error: null,
    });

    // Conversation bumped exactly once on success
    expect(persistence.bumpConversationUpdatedAt).toHaveBeenCalledTimes(1);
    expect(persistence.bumpConversationUpdatedAt).toHaveBeenCalledWith(CONVERSATION_ID);
  });

  it('prepends historical messages (loaded from DB) into the LLM context', async () => {
    const priorHistory: MessageRow[] = [
      {
        id: 'old-1',
        conversationId: CONVERSATION_ID,
        role: 'user',
        content: [{ type: 'text', text: 'earlier turn' }],
        intent: null,
        model: null,
        latencyMs: null,
        tokenUsage: null,
        error: null,
        createdAt: new Date('2026-04-18T09:00:00.000Z'),
        metadata: {},
      },
      {
        id: 'old-2',
        conversationId: CONVERSATION_ID,
        role: 'assistant',
        content: [{ type: 'text', text: 'earlier reply' }],
        intent: null,
        model: 'claude-sonnet-4-6',
        latencyMs: 300,
        tokenUsage: null,
        error: null,
        createdAt: new Date('2026-04-18T09:00:05.000Z'),
        metadata: {},
      },
    ];
    const persistence = makeMockPersistence({ historyRows: priorHistory });

    const mockLLM = makeMockLLM([llmResponse('end_turn', [textBlock('OK')])]);

    const service = new JarvisService({
      llm: mockLLM,
      registry: new ToolRegistry(),
      db: createMockDb() as unknown as Database,
      persistence,
      now: () => NOW,
    });

    await service.handleMessage({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      userMessage: 'follow up',
      logger: makeLogger(),
    });

    const firstReq = mockLLM.sendMessage.mock.calls[0]![0] as LLMRequest;
    // Messages: [old-1 user, old-2 assistant, new user]
    expect(firstReq.messages).toHaveLength(3);
    expect(firstReq.messages[0]!.role).toBe('user');
    expect(firstReq.messages[1]!.role).toBe('assistant');
    expect(firstReq.messages[2]!.role).toBe('user');
  });
});

/* ─────────────── tool error surfaces as is_error tool_result ─────────────── */

describe('JarvisService.handleMessage — tool failures', () => {
  it('surfaces a failing tool as an is_error tool_result and persists error on the tool_call row', async () => {
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
    const persistence = makeMockPersistence();

    const service = new JarvisService({
      llm: mockLLM,
      registry,
      db: createMockDb() as unknown as Database,
      persistence,
      now: () => NOW,
    });

    const result = await service.handleMessage({
      conversationId: CONVERSATION_ID,
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
    // tool_call row records the failure
    expect(persistence.insertToolCall.mock.calls[0]![0]).toMatchObject({
      toolName: 'failingTool',
      error: expect.stringMatching(/synthetic failure/),
      result: null,
    });
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

    const makeToolUse = () =>
      llmResponse('tool_use', [toolUseBlock(`tu_${Math.random()}`, 'noop', {})]);
    const sendMessage = vi
      .fn<(req: LLMRequest) => Promise<LLMResponse>>()
      .mockImplementation(async () => makeToolUse());
    const streamMessage = vi
      .fn<(req: LLMRequest, opts: { onTextDelta: (t: string) => void }) => Promise<LLMResponse>>()
      .mockImplementation(async () => makeToolUse());
    const mockLLM: LLMProvider = { sendMessage, streamMessage };
    const persistence = makeMockPersistence();

    const logger = makeLogger();
    const service = new JarvisService({
      llm: mockLLM,
      registry,
      db: createMockDb() as unknown as Database,
      persistence,
      now: () => NOW,
      toolLoopMax: 3,
    });

    const result = await service.handleMessage({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      userMessage: 'loop forever',
      logger,
    });

    expect(result.loopExhausted).toBe(true);
    expect(result.stopReason).toBe('tool_loop_exhausted');
    expect(result.toolCalls).toHaveLength(3);
    expect(result.assistantText).toMatch(/rephrase/i);
    expect(sendMessage).toHaveBeenCalledTimes(3);
    // 1 user + 3 assistants + 3 tool-batches persisted
    expect(persistence.insertMessage).toHaveBeenCalledTimes(1 + 3 + 3);
    expect(persistence.bumpConversationUpdatedAt).toHaveBeenCalledTimes(1);
  });
});

/* ─────────────── turn timeout ─────────────── */

describe('JarvisService.handleMessage — turn timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('throws TurnTimeoutError, persists an error-marker assistant message, and re-throws', async () => {
    const mockLLM: LLMProvider = {
      sendMessage: () => new Promise(() => {}),
      streamMessage: () => new Promise(() => {}),
    };
    const persistence = makeMockPersistence();

    const service = new JarvisService({
      llm: mockLLM,
      registry: new ToolRegistry(),
      db: createMockDb() as unknown as Database,
      persistence,
      now: () => NOW,
      turnTimeoutMs: 1000,
    });

    const promise = service.handleMessage({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      userMessage: 'slow',
      logger: makeLogger(),
    });
    const assertion = expect(promise).rejects.toBeInstanceOf(TurnTimeoutError);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;

    // User message saved first, then error-marker assistant message.
    const inserted = persistence.insertMessage.mock.calls.map((c) => c[0]);
    expect(inserted.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(inserted[1]).toMatchObject({
      role: 'assistant',
      content: [],
      error: { name: 'TurnTimeoutError' },
    });
    // Still bump updated_at so the list view surfaces the failed turn.
    expect(persistence.bumpConversationUpdatedAt).toHaveBeenCalledTimes(1);
  });
});

/* ─────────────── streamMessage events ─────────────── */

describe('JarvisService.streamMessage', () => {
  it('emits intent → tool_call_start/end → text_delta → done across a two-turn flow', async () => {
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

    const mockLLM = makeMockLLM([
      llmResponse('tool_use', [toolUseBlock('tu_1', 'noop', {})]),
      llmResponse('end_turn', [textBlock('All done.')], {
        usage: usage({ inputTokens: 50, outputTokens: 10 }),
      }),
    ]);

    const persistence = makeMockPersistence();
    const service = new JarvisService({
      llm: mockLLM,
      registry,
      db: createMockDb() as unknown as Database,
      persistence,
      now: () => NOW,
    });

    const events: JarvisStreamEvent[] = [];
    const result = await service.streamMessage(
      {
        conversationId: CONVERSATION_ID,
        userId: USER_ID,
        userMessage: 'hi',
        logger: makeLogger(),
      },
      (e) => events.push(e),
    );

    const types = events.map((e) => e.type);
    expect(types).toEqual(['intent', 'tool_call_start', 'tool_call_end', 'text_delta', 'done']);

    const intent = events[0] as Extract<JarvisStreamEvent, { type: 'intent' }>;
    expect(intent.intent).toBe('');

    const start = events[1] as Extract<JarvisStreamEvent, { type: 'tool_call_start' }>;
    expect(start.toolName).toBe('noop');
    expect(start.toolCallId).toBe('tu_1');

    const end = events[2] as Extract<JarvisStreamEvent, { type: 'tool_call_end' }>;
    expect(end.success).toBe(true);
    expect(end.toolCallId).toBe('tu_1');

    const delta = events[3] as Extract<JarvisStreamEvent, { type: 'text_delta' }>;
    expect(delta.text).toBe('All done.');

    const done = events[4] as Extract<JarvisStreamEvent, { type: 'done' }>;
    expect(done.stopReason).toBe('end_turn');
    expect(done.messageId).toBe(result.lastAssistantMessageId);
    expect(done.tokenUsage.inputTokens).toBe(50);
  });

  it('emits an error event when a turn fails (stream LLM throws)', async () => {
    const sendMessage = vi.fn(async (): Promise<LLMResponse> => {
      throw new Error('boom');
    });
    const streamMessage = vi.fn(async (): Promise<LLMResponse> => {
      throw new Error('boom');
    });
    const persistence = makeMockPersistence();
    const service = new JarvisService({
      llm: { sendMessage, streamMessage },
      registry: new ToolRegistry(),
      db: createMockDb() as unknown as Database,
      persistence,
      now: () => NOW,
    });

    const events: JarvisStreamEvent[] = [];
    await expect(
      service.streamMessage(
        {
          conversationId: CONVERSATION_ID,
          userId: USER_ID,
          userMessage: 'hi',
          logger: makeLogger(),
        },
        (e) => events.push(e),
      ),
    ).rejects.toThrow(/boom/);

    // intent first, then the error event.
    expect(events.map((e) => e.type)).toEqual(['intent', 'error']);
    const err = events[1] as Extract<JarvisStreamEvent, { type: 'error' }>;
    expect(err.message).toMatch(/boom/);
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
      persistence: makeMockPersistence(),
      now: () => NOW,
    });

    const result = await service.handleMessage({
      conversationId: CONVERSATION_ID,
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

describe('dbMessageToAnthropic', () => {
  function row(role: 'user' | 'assistant' | 'tool', content: unknown): MessageRow {
    return {
      id: 'x',
      conversationId: CONVERSATION_ID,
      role,
      content,
      intent: null,
      model: null,
      latencyMs: null,
      tokenUsage: null,
      error: null,
      createdAt: NOW,
      metadata: {},
    };
  }

  it('maps user rows as-is', () => {
    const anth = dbMessageToAnthropic(row('user', [{ type: 'text', text: 'hi' }]));
    expect(anth).toEqual({ role: 'user', content: [{ type: 'text', text: 'hi' }] });
  });

  it('maps assistant rows as-is', () => {
    const anth = dbMessageToAnthropic(row('assistant', [{ type: 'text', text: 'hello' }]));
    expect(anth).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'hello' }] });
  });

  it('maps tool rows to user role (Anthropic carries tool_result on user messages)', () => {
    const anth = dbMessageToAnthropic(
      row('tool', [{ type: 'tool_result', tool_use_id: 'tu_1', content: '...' }]),
    );
    expect(anth.role).toBe('user');
    expect(anth.content).toEqual([{ type: 'tool_result', tool_use_id: 'tu_1', content: '...' }]);
  });
});
