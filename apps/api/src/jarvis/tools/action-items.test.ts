import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import type { JarvisLogger, ToolContext } from './types.ts';
import { getActionItems, getOverdueActionItems } from './action-items.ts';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const BRAND_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const NOW = new Date('2026-04-19T12:00:00.000Z');

function makeLogger(): JarvisLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeCtx(db: unknown, now = NOW): ToolContext {
  return {
    userId: USER_ID,
    now,
    db: db as unknown as Database,
    logger: makeLogger(),
  };
}

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ai-1',
    brandId: BRAND_ID,
    meetingId: null,
    creatorId: USER_ID,
    assigneeId: USER_ID,
    text: 'Send the deck',
    status: 'open' as const,
    owner: null,
    dueDate: '2026-04-10', // before NOW → overdue
    linkedTaskId: null,
    createdAt: new Date('2026-04-05T12:00:00.000Z'),
    completedAt: null,
    ...overrides,
  };
}

describe('getActionItems', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getActionItems.name).toBe('getActionItems');
    expect(getActionItems.readOnly).toBe(true);
    expect(getActionItems.description).toMatch(/across brands/i);
  });

  it('returns matching action items serialized with ISO timestamps', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow()]);
    const ctx = makeCtx(mockDb);
    const result = await getActionItems.handler(
      { assigneeId: USER_ID, status: 'open', limit: 100 },
      ctx,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'ai-1',
      status: 'open',
      dueDate: '2026-04-10',
      createdAt: '2026-04-05T12:00:00.000Z',
    });
  });

  it('returns [] when no items match', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    const ctx = makeCtx(mockDb);
    const result = await getActionItems.handler({ limit: 100 }, ctx);
    expect(result).toEqual([]);
  });

  it('accepts dueBefore as an ISO date', () => {
    const parsed = getActionItems.inputSchema.parse({ dueBefore: '2026-04-25' });
    expect(parsed.dueBefore).toBe('2026-04-25');
  });

  it('rejects malformed dueBefore', () => {
    expect(() => getActionItems.inputSchema.parse({ dueBefore: 'soon' })).toThrow();
  });
});

describe('getOverdueActionItems', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getOverdueActionItems.name).toBe('getOverdueActionItems');
    expect(getOverdueActionItems.readOnly).toBe(true);
    expect(getOverdueActionItems.description).toMatch(/overdue/i);
  });

  it('queries using ctx.now as the due-before cutoff', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([sampleRow()]);
    const ctx = makeCtx(mockDb, new Date('2026-04-19T12:00:00.000Z'));
    const result = await getOverdueActionItems.handler({ limit: 100 }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]!.dueDate).toBe('2026-04-10');
  });

  it('accepts an optional assigneeId for scoping', () => {
    expect(() => getOverdueActionItems.inputSchema.parse({})).not.toThrow();
    expect(() => getOverdueActionItems.inputSchema.parse({ assigneeId: USER_ID })).not.toThrow();
  });
});
