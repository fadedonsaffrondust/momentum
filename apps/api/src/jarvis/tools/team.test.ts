import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import type { JarvisLogger, ToolContext } from './types.ts';
import { getTeamMembers, getMemberTasks } from './team.ts';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const MEMBER_ID = '00000000-0000-0000-0000-0000000000b2';
const NOW = new Date('2026-04-19T12:00:00.000Z');

function makeLogger(): JarvisLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeCtx(db: unknown): ToolContext {
  return {
    userId: USER_ID,
    now: NOW,
    db: db as unknown as Database,
    logger: makeLogger(),
  };
}

describe('getTeamMembers', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getTeamMembers.name).toBe('getTeamMembers');
    expect(getTeamMembers.readOnly).toBe(true);
    expect(getTeamMembers.description).toMatch(/on the team|who/i);
  });

  it('returns active team members with ISO createdAt', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      {
        id: MEMBER_ID,
        email: 'sara@omnirev.ai',
        displayName: 'Sara Smith',
        avatarColor: '#0FB848',
        createdAt: new Date('2025-12-01T00:00:00.000Z'),
      },
    ]);
    const ctx = makeCtx(mockDb);
    const result = await getTeamMembers.handler({}, ctx);
    expect(result).toEqual([
      {
        id: MEMBER_ID,
        email: 'sara@omnirev.ai',
        displayName: 'Sara Smith',
        avatarColor: '#0FB848',
        createdAt: '2025-12-01T00:00:00.000Z',
      },
    ]);
  });

  it('accepts an empty input object', () => {
    expect(() => getTeamMembers.inputSchema.parse({})).not.toThrow();
  });
});

describe('getMemberTasks', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getMemberTasks.name).toBe('getMemberTasks');
    expect(getMemberTasks.readOnly).toBe(true);
    expect(getMemberTasks.description).toMatch(/specific team member/i);
  });

  it("returns that member's tasks with ISO timestamps", async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      {
        id: '11111111-1111-1111-1111-111111111111',
        creatorId: USER_ID,
        assigneeId: MEMBER_ID,
        title: 'Prep QBR deck',
        roleId: null,
        priority: 'medium',
        estimateMinutes: 60,
        actualMinutes: null,
        status: 'todo',
        column: 'up_next',
        scheduledDate: '2026-04-22',
        createdAt: new Date('2026-04-18T09:00:00.000Z'),
        startedAt: null,
        completedAt: null,
      },
    ]);
    const ctx = makeCtx(mockDb);
    const result = await getMemberTasks.handler({ memberId: MEMBER_ID, limit: 50 }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]!.assigneeId).toBe(MEMBER_ID);
    expect(result[0]!.createdAt).toBe('2026-04-18T09:00:00.000Z');
  });

  it('requires a valid memberId UUID', () => {
    expect(() => getMemberTasks.inputSchema.parse({ memberId: 'not-a-uuid' })).toThrow();
  });
});
