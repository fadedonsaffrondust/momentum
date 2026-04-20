import { describe, it, expect } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import { insertToolCall, listToolCallsByMessage } from './tool-calls.ts';

const MESSAGE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tctctctc-tctc-tctc-tctc-tctctctctctc',
    messageId: MESSAGE_ID,
    toolName: 'getMyTasks',
    arguments: { limit: 10 },
    result: [{ id: 'task-1', title: 'x' }],
    error: null,
    latencyMs: 14,
    createdAt: new Date('2026-04-19T12:00:00.000Z'),
    metadata: {},
    ...overrides,
  };
}

describe('insertToolCall', () => {
  it('inserts a successful tool call with result and null error', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow()]);

    const row = await insertToolCall(mockDb as unknown as Database, {
      messageId: MESSAGE_ID,
      toolName: 'getMyTasks',
      arguments: { limit: 10 },
      result: [{ id: 'task-1', title: 'x' }],
      latencyMs: 14,
    });

    expect(row.toolName).toBe('getMyTasks');
    expect(row.error).toBeNull();
    expect(row.result).toEqual([{ id: 'task-1', title: 'x' }]);
    expect(row.latencyMs).toBe(14);
  });

  it('inserts a failed tool call with error string and null result', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      sampleRow({
        result: null,
        error: 'Tool "getMyTasks" failed: invalid arguments',
      }),
    ]);

    const row = await insertToolCall(mockDb as unknown as Database, {
      messageId: MESSAGE_ID,
      toolName: 'getMyTasks',
      arguments: { limit: 'not-a-number' },
      error: 'Tool "getMyTasks" failed: invalid arguments',
      latencyMs: 3,
    });

    expect(row.error).toMatch(/invalid arguments/);
    expect(row.result).toBeNull();
  });

  it('throws if the insert returned no row', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    await expect(
      insertToolCall(mockDb as unknown as Database, {
        messageId: MESSAGE_ID,
        toolName: 'x',
        arguments: {},
        latencyMs: 1,
      }),
    ).rejects.toThrow(/returned no row/);
  });
});

describe('listToolCallsByMessage', () => {
  it('returns rows for the given assistant message', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow(), sampleRow({ id: 'tc-2', toolName: 'getBrand' })]);
    const rows = await listToolCallsByMessage(mockDb as unknown as Database, MESSAGE_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.toolName).toBe('getMyTasks');
    expect(rows[1]!.toolName).toBe('getBrand');
  });
});
