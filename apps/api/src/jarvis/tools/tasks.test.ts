import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import type { ToolContext, JarvisLogger } from './types.ts';
import { getMyTasks } from './tasks.ts';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const NOW = new Date('2026-04-19T12:00:00.000Z');

function makeLogger(): JarvisLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeCtx(dbOverride?: unknown): ToolContext {
  return {
    userId: USER_ID,
    now: NOW,
    db: (dbOverride ?? createMockDb()) as unknown as Database,
    logger: makeLogger(),
  };
}

function sampleTaskRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    creatorId: USER_ID,
    assigneeId: USER_ID,
    title: 'Ship Jarvis Task 3',
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
    ...overrides,
  };
}

describe('getMyTasks', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getMyTasks.name).toBe('getMyTasks');
    expect(getMyTasks.readOnly).toBe(true);
    expect(getMyTasks.description).toMatch(/my tasks|own work/i);
  });

  it('returns a mapped task list with ISO timestamps (no Date objects)', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleTaskRow()]);
    const ctx = makeCtx(mockDb);

    const result = await getMyTasks.handler({ limit: 50 }, ctx);

    expect(result).toHaveLength(1);
    const task = result[0]!;
    expect(task.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(task.title).toBe('Ship Jarvis Task 3');
    expect(task.scheduledDate).toBe('2026-04-19');
    expect(task.createdAt).toBe('2026-04-18T09:00:00.000Z');
    expect(task.startedAt).toBe('2026-04-19T10:00:00.000Z');
    expect(task.completedAt).toBeNull();
    // Ensure no Date leaked through
    for (const value of Object.values(task)) {
      expect(value).not.toBeInstanceOf(Date);
    }
  });

  it('returns an empty array when the user has no tasks', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    const ctx = makeCtx(mockDb);

    const result = await getMyTasks.handler({ limit: 50 }, ctx);
    expect(result).toEqual([]);
  });

  it('applies the input limit default to 50 via Zod', () => {
    const parsed = getMyTasks.inputSchema.parse({});
    expect(parsed.limit).toBe(50);
  });

  it('rejects limits outside [1, 100]', () => {
    expect(() => getMyTasks.inputSchema.parse({ limit: 0 })).toThrow();
    expect(() => getMyTasks.inputSchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects malformed dateFrom / dateTo', () => {
    expect(() => getMyTasks.inputSchema.parse({ dateFrom: '04/19/2026' })).toThrow();
    expect(() => getMyTasks.inputSchema.parse({ dateTo: 'tomorrow' })).toThrow();
  });

  it('accepts a status filter', () => {
    const parsed = getMyTasks.inputSchema.parse({ status: 'done' });
    expect(parsed.status).toBe('done');
  });
});
