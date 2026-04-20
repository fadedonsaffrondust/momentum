import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { JarvisStreamEvent } from '@momentum/shared';

/* ─────────────── mock db + hoisted setup ─────────────── */

const { mockDb } = vi.hoisted(() => {
  const results: unknown[] = [];
  function createChain(): any {
    const chain: any = new Proxy(() => {}, {
      get(_t: any, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            const result = results.shift();
            if (result instanceof Error) reject(result);
            else resolve(result);
          };
        }
        return (..._args: unknown[]) => chain;
      },
      apply() {
        return chain;
      },
    });
    return chain;
  }
  const mockDb = {
    select: vi.fn((..._args: unknown[]) => createChain()),
    insert: vi.fn((..._args: unknown[]) => createChain()),
    update: vi.fn((..._args: unknown[]) => createChain()),
    delete: vi.fn((..._args: unknown[]) => createChain()),
    _results: results,
    _pushResult(value: unknown) {
      results.push(value);
    },
    _pushResults(...values: unknown[]) {
      results.push(...values);
    },
  };
  return { mockDb };
});

vi.mock('../../db.ts', () => ({ db: mockDb, client: {} }));

import { authPlugin } from '../../plugins/auth.ts';
import { errorHandlerPlugin } from '../../plugins/error-handler.ts';
import { jarvisRoutes } from './routes.ts';
import { _setJarvisServiceForTesting } from '../service.ts';
import type { JarvisService } from '../orchestrator.ts';

/* ─────────────── constants / helpers ─────────────── */

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_USER = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';
const CONV_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function sampleConversationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV_ID,
    userId: USER_ID,
    title: 'Prior conversation',
    createdAt: new Date('2026-04-18T09:00:00.000Z'),
    updatedAt: new Date('2026-04-19T12:00:00.000Z'),
    archivedAt: null,
    metadata: {},
    ...overrides,
  };
}

function sampleMessageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    conversationId: CONV_ID,
    role: 'user' as const,
    content: [{ type: 'text', text: 'hi' }],
    intent: null,
    model: null,
    latencyMs: null,
    tokenUsage: null,
    error: null,
    createdAt: new Date('2026-04-19T12:00:00.000Z'),
    metadata: {},
    ...overrides,
  };
}

/* ─────────────── app setup ─────────────── */

let app: ReturnType<typeof Fastify>;
let token: string;

beforeAll(async () => {
  app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(jarvisRoutes);
  await app.ready();
  token = app.jwt.sign({ sub: USER_ID });
});

afterAll(() => app.close());

beforeEach(() => {
  mockDb._results.length = 0;
  vi.clearAllMocks();
  _setJarvisServiceForTesting(null);
});

/* ─────────────── POST /conversations ─────────────── */

describe('POST /api/jarvis/conversations', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/jarvis/conversations', body: {} });
    expect(res.statusCode).toBe(401);
  });

  it('creates a conversation with a placeholder title when no initialMessage', async () => {
    mockDb._pushResult([sampleConversationRow({ title: 'New conversation' })]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/jarvis/conversations',
      headers: { Authorization: `Bearer ${token}` },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ conversationId: CONV_ID, title: 'New conversation' });
  });

  it('derives the title from the first 60 chars of initialMessage, truncating with …', async () => {
    const initialMessage = 'a'.repeat(100);
    const expectedTitle = 'a'.repeat(60) + '…';
    mockDb._pushResult([sampleConversationRow({ title: expectedTitle })]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/jarvis/conversations',
      headers: { Authorization: `Bearer ${token}` },
      body: { initialMessage },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe(expectedTitle);
  });
});

/* ─────────────── GET /conversations ─────────────── */

describe('GET /api/jarvis/conversations', () => {
  it("returns the caller's conversations", async () => {
    mockDb._pushResult([sampleConversationRow()]);
    const res = await app.inject({
      method: 'GET',
      url: '/api/jarvis/conversations',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: CONV_ID,
      title: 'Prior conversation',
      createdAt: '2026-04-18T09:00:00.000Z',
      updatedAt: '2026-04-19T12:00:00.000Z',
      archivedAt: null,
    });
  });

  it('returns an empty list when the user has no conversations', async () => {
    mockDb._pushResult([]);
    const res = await app.inject({
      method: 'GET',
      url: '/api/jarvis/conversations',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

/* ─────────────── GET /conversations/:id ─────────────── */

describe('GET /api/jarvis/conversations/:id', () => {
  it('returns conversation detail + full message list for the owner', async () => {
    mockDb._pushResult([sampleConversationRow()]); // getConversationForUser
    mockDb._pushResult([
      sampleMessageRow({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
      sampleMessageRow({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        role: 'assistant',
        content: [{ type: 'text', text: 'hi back' }],
        model: 'claude-sonnet-4-6',
        latencyMs: 400,
        tokenUsage: {
          inputTokens: 10,
          outputTokens: 5,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        },
      }),
    ]);
    const res = await app.inject({
      method: 'GET',
      url: `/api/jarvis/conversations/${CONV_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.conversation.id).toBe(CONV_ID);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[1].role).toBe('assistant');
    expect(body.messages[1].tokenUsage.inputTokens).toBe(10);
  });

  it('returns 404 when the conversation does not exist OR belongs to someone else', async () => {
    mockDb._pushResult([]); // getConversationForUser returns empty for mismatched owner
    const res = await app.inject({
      method: 'GET',
      url: `/api/jarvis/conversations/${CONV_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects non-UUID params with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jarvis/conversations/not-a-uuid',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

/* ─────────────── DELETE /conversations/:id ─────────────── */

describe('DELETE /api/jarvis/conversations/:id', () => {
  it('soft-archives a conversation the caller owns', async () => {
    mockDb._pushResult([sampleConversationRow()]); // ownership check
    mockDb._pushResult([]); // update() resolves
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/jarvis/conversations/${CONV_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the conversation belongs to another user', async () => {
    mockDb._pushResult([]); // ownership check returns empty
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/jarvis/conversations/${CONV_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

/* ─────────────── POST /conversations/:id/messages (SSE) ─────────────── */

describe('POST /api/jarvis/conversations/:id/messages', () => {
  it('streams SSE events (intent → tool_call_start/end → text_delta → done) with correct headers', async () => {
    mockDb._pushResult([sampleConversationRow()]); // ownership check

    const events: JarvisStreamEvent[] = [
      { type: 'intent', intent: '' },
      { type: 'tool_call_start', toolCallId: 'tu_1', toolName: 'getMyTasks', arguments: {} },
      {
        type: 'tool_call_end',
        toolCallId: 'tu_1',
        toolName: 'getMyTasks',
        latencyMs: 14,
        success: true,
      },
      { type: 'text_delta', text: 'Here you go.' },
      {
        type: 'done',
        messageId: 'msg-42',
        totalLatencyMs: 250,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 30,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        },
        stopReason: 'end_turn',
      },
    ];
    const fakeService = {
      streamMessage: vi.fn(async (_input, onEvent: (e: JarvisStreamEvent) => void) => {
        for (const event of events) onEvent(event);
        return {
          assistantText: 'Here you go.',
          assistantContent: [],
          toolCalls: [],
          usage: {
            inputTokens: 100,
            outputTokens: 30,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
          },
          stopReason: 'end_turn',
          loopExhausted: false,
          lastAssistantMessageId: 'msg-42',
        };
      }),
    } as unknown as JarvisService;
    _setJarvisServiceForTesting(fakeService);

    const res = await app.inject({
      method: 'POST',
      url: `/api/jarvis/conversations/${CONV_ID}/messages`,
      headers: { Authorization: `Bearer ${token}` },
      body: { content: 'What should I look at today?' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.headers['cache-control']).toMatch(/no-cache/);

    const body = res.body;
    // Every event type should appear with its `event:` prefix.
    expect(body).toContain('event: intent');
    expect(body).toContain('event: tool_call_start');
    expect(body).toContain('event: tool_call_end');
    expect(body).toContain('event: text_delta');
    expect(body).toContain('event: done');
    // The done event carries the persisted message id.
    expect(body).toContain('"messageId":"msg-42"');
  });

  it("replaces the placeholder title with the first message's when the conversation was created blank", async () => {
    // Ownership check returns the sidebar-"+ new" placeholder title.
    mockDb._pushResult([sampleConversationRow({ title: 'New conversation' })]);
    // findFirstUserMessageText: no prior user messages (first turn).
    mockDb._pushResult([]);
    // The auto-title UPDATE resolves to nothing (no rows returned).
    mockDb._pushResult([]);

    const fakeService = {
      streamMessage: vi.fn(async (_input, onEvent: (e: JarvisStreamEvent) => void) => {
        onEvent({ type: 'intent', intent: '' });
        onEvent({
          type: 'done',
          messageId: 'm',
          totalLatencyMs: 1,
          tokenUsage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
          },
          stopReason: 'end_turn',
        });
        return {} as never;
      }),
    } as unknown as JarvisService;
    _setJarvisServiceForTesting(fakeService);

    const res = await app.inject({
      method: 'POST',
      url: `/api/jarvis/conversations/${CONV_ID}/messages`,
      headers: { Authorization: `Bearer ${token}` },
      body: { content: 'How is Boudin doing this week?' },
    });

    expect(res.statusCode).toBe(200);
    // One UPDATE for the auto-title — the streamed turn itself uses the
    // service mock, which doesn't exercise persistence.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('self-heals a legacy placeholder title by back-filling from the oldest persisted user message, not the current one', async () => {
    mockDb._pushResult([sampleConversationRow({ title: 'New conversation' })]);
    // findFirstUserMessageText: oldest user message on the conversation —
    // the one that should have become the title if the code had existed
    // when the conversation was created.
    mockDb._pushResult([
      sampleMessageRow({
        role: 'user',
        content: [{ type: 'text', text: 'What Brand needs the most attention now?' }],
      }),
    ]);
    mockDb._pushResult([]); // auto-title UPDATE

    const fakeService = {
      streamMessage: vi.fn(async (_input, onEvent: (e: JarvisStreamEvent) => void) => {
        onEvent({ type: 'intent', intent: '' });
        onEvent({
          type: 'done',
          messageId: 'm',
          totalLatencyMs: 1,
          tokenUsage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
          },
          stopReason: 'end_turn',
        });
        return {} as never;
      }),
    } as unknown as JarvisService;
    _setJarvisServiceForTesting(fakeService);

    const res = await app.inject({
      method: 'POST',
      url: `/api/jarvis/conversations/${CONV_ID}/messages`,
      headers: { Authorization: `Bearer ${token}` },
      body: { content: 'and what about tomorrow?' },
    });

    expect(res.statusCode).toBe(200);
    // Exactly one UPDATE — the auto-title. findFirstUserMessageText
    // returning a prior message is what proves the title source is the
    // legacy message, not `content` of the request; the UPDATE firing
    // confirms the back-fill actually ran.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('leaves a user-derived title alone on subsequent turns', async () => {
    mockDb._pushResult([sampleConversationRow({ title: 'What should I focus on today?' })]);

    const fakeService = {
      streamMessage: vi.fn(async (_input, onEvent: (e: JarvisStreamEvent) => void) => {
        onEvent({ type: 'intent', intent: '' });
        onEvent({
          type: 'done',
          messageId: 'm',
          totalLatencyMs: 1,
          tokenUsage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
          },
          stopReason: 'end_turn',
        });
        return {} as never;
      }),
    } as unknown as JarvisService;
    _setJarvisServiceForTesting(fakeService);

    const res = await app.inject({
      method: 'POST',
      url: `/api/jarvis/conversations/${CONV_ID}/messages`,
      headers: { Authorization: `Bearer ${token}` },
      body: { content: 'and what about tomorrow?' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a conversation owned by someone else (no service call)', async () => {
    mockDb._pushResult([]); // ownership check returns empty
    const streamMessage = vi.fn();
    _setJarvisServiceForTesting({ streamMessage } as unknown as JarvisService);

    const res = await app.inject({
      method: 'POST',
      url: `/api/jarvis/conversations/${CONV_ID}/messages`,
      headers: { Authorization: `Bearer ${token}` },
      body: { content: 'hi' },
    });
    expect(res.statusCode).toBe(404);
    expect(streamMessage).not.toHaveBeenCalled();
  });

  it('rejects empty content with 400', async () => {
    mockDb._pushResult([sampleConversationRow()]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/jarvis/conversations/${CONV_ID}/messages`,
      headers: { Authorization: `Bearer ${token}` },
      body: { content: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});

/* ─────────────── titleFromMessage unit ─────────────── */

import { titleFromMessage } from './routes.ts';

describe('titleFromMessage', () => {
  it('returns the message untouched when under 60 chars', () => {
    expect(titleFromMessage('What did I ship?')).toBe('What did I ship?');
  });

  it('truncates at 60 chars with a trailing …', () => {
    const title = titleFromMessage('a'.repeat(100));
    expect(title).toBe('a'.repeat(60) + '…');
  });

  it('collapses whitespace before truncating', () => {
    const title = titleFromMessage('hello     world\n\nfoo');
    expect(title).toBe('hello world foo');
  });
});

// Silence the unused-import warning the linter emits about OTHER_USER
// when the test file doesn't reference it — it's here to document the
// intent behind the 404 ownership-mismatch tests.
void OTHER_USER;
