import { describe, it, expect } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import {
  insertMessage,
  listMessagesByConversation,
  listAllMessagesByConversation,
  findFirstUserMessageText,
} from './messages.ts';

const CONVERSATION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm',
    conversationId: CONVERSATION_ID,
    role: 'user' as const,
    content: [{ type: 'text', text: 'hello' }],
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

describe('insertMessage', () => {
  it('inserts a user text message and normalizes the return', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow()]);

    const row = await insertMessage(mockDb as unknown as Database, {
      conversationId: CONVERSATION_ID,
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
    });

    expect(row.role).toBe('user');
    expect(row.intent).toBeNull();
    expect(row.tokenUsage).toBeNull();
    expect(row.metadata).toEqual({});
  });

  it('inserts an assistant message with token usage', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      sampleRow({
        role: 'assistant',
        content: [{ type: 'text', text: 'Here you go' }],
        model: 'claude-sonnet-4-6',
        latencyMs: 412,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 80,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        },
      }),
    ]);

    const row = await insertMessage(mockDb as unknown as Database, {
      conversationId: CONVERSATION_ID,
      role: 'assistant',
      content: [{ type: 'text', text: 'Here you go' }],
      model: 'claude-sonnet-4-6',
      latencyMs: 412,
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 80,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
    });

    expect(row.role).toBe('assistant');
    expect(row.model).toBe('claude-sonnet-4-6');
    expect(row.latencyMs).toBe(412);
    expect(row.tokenUsage).toEqual({
      inputTokens: 100,
      outputTokens: 80,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
  });

  it('persists an error jsonb when the turn failed', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      sampleRow({
        role: 'assistant',
        content: [],
        error: { name: 'TurnTimeoutError', message: 'exceeded 30000ms' },
      }),
    ]);

    const row = await insertMessage(mockDb as unknown as Database, {
      conversationId: CONVERSATION_ID,
      role: 'assistant',
      content: [],
      error: { name: 'TurnTimeoutError', message: 'exceeded 30000ms' },
    });

    expect(row.error).toEqual({ name: 'TurnTimeoutError', message: 'exceeded 30000ms' });
  });

  it('throws if the insert returned no row', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    await expect(
      insertMessage(mockDb as unknown as Database, {
        conversationId: CONVERSATION_ID,
        role: 'user',
        content: [{ type: 'text', text: 'hi' }],
      }),
    ).rejects.toThrow(/returned no row/);
  });
});

describe('listMessagesByConversation', () => {
  it('reverses DESC-LIMIT results so Anthropic gets chronological order', async () => {
    const mockDb = createMockDb();
    // DB returns newest-first; persistence layer reverses to oldest-first.
    mockDb._pushResult([
      sampleRow({ id: 'm3', createdAt: new Date('2026-04-19T12:03:00Z') }),
      sampleRow({ id: 'm2', createdAt: new Date('2026-04-19T12:02:00Z') }),
      sampleRow({ id: 'm1', createdAt: new Date('2026-04-19T12:01:00Z') }),
    ]);

    const rows = await listMessagesByConversation(mockDb as unknown as Database, CONVERSATION_ID);
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('returns [] for an empty conversation', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    const rows = await listMessagesByConversation(mockDb as unknown as Database, CONVERSATION_ID);
    expect(rows).toEqual([]);
  });
});

describe('listAllMessagesByConversation', () => {
  it('passes rows through in ASC order (DB already sorted)', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow({ id: 'm1' }), sampleRow({ id: 'm2' }), sampleRow({ id: 'm3' })]);
    const rows = await listAllMessagesByConversation(
      mockDb as unknown as Database,
      CONVERSATION_ID,
    );
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('findFirstUserMessageText', () => {
  it('returns the oldest user message as plain text', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      sampleRow({
        role: 'user',
        content: [{ type: 'text', text: 'What Brand needs the most attention now?' }],
      }),
    ]);
    const text = await findFirstUserMessageText(mockDb as unknown as Database, CONVERSATION_ID);
    expect(text).toBe('What Brand needs the most attention now?');
  });

  it('concatenates multiple text blocks so split user messages round-trip', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      sampleRow({
        role: 'user',
        content: [
          { type: 'text', text: 'first line' },
          { type: 'text', text: 'second line' },
        ],
      }),
    ]);
    const text = await findFirstUserMessageText(mockDb as unknown as Database, CONVERSATION_ID);
    expect(text).toBe('first line\nsecond line');
  });

  it('returns null when the conversation has no user messages yet', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    const text = await findFirstUserMessageText(mockDb as unknown as Database, CONVERSATION_ID);
    expect(text).toBeNull();
  });

  it('returns null when the message has no text blocks (e.g. pure tool_result row)', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      sampleRow({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '{"ok":true}' }],
      }),
    ]);
    const text = await findFirstUserMessageText(mockDb as unknown as Database, CONVERSATION_ID);
    expect(text).toBeNull();
  });
});
