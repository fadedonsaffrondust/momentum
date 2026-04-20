import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@momentum/db';
import { createMockDb } from '../../test/mock-db.ts';
import type { JarvisLogger, ToolContext } from './types.ts';
import { getRecentMeetings, getMeeting } from './meetings.ts';

const USER_ID = '00000000-0000-0000-0000-0000000000a1';
const BRAND_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MEETING_ID = 'mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm';
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

describe('getRecentMeetings', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getRecentMeetings.name).toBe('getRecentMeetings');
    expect(getRecentMeetings.readOnly).toBe(true);
    expect(getRecentMeetings.description).toMatch(/recent meetings/i);
  });

  it('returns meetings with ISO createdAt (summary only, raw notes omitted)', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      {
        id: MEETING_ID,
        brandId: BRAND_ID,
        title: 'Boudin QBR',
        date: '2026-04-18',
        source: 'manual',
        summary: 'Good ops check-in.',
        createdAt: new Date('2026-04-18T09:00:00.000Z'),
      },
    ]);
    const ctx = makeCtx(mockDb);
    const result = await getRecentMeetings.handler({ limit: 10 }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: MEETING_ID,
      title: 'Boudin QBR',
      date: '2026-04-18',
      createdAt: '2026-04-18T09:00:00.000Z',
    });
    // Raw notes + decisions are intentionally not part of this tool's output.
    expect(result[0]).not.toHaveProperty('rawNotes');
    expect(result[0]).not.toHaveProperty('decisions');
  });
});

describe('getMeeting', () => {
  it('has a descriptive, V1-shaped definition', () => {
    expect(getMeeting.name).toBe('getMeeting');
    expect(getMeeting.readOnly).toBe(true);
    expect(getMeeting.description).toMatch(/full content of one meeting|full detail/i);
  });

  it('returns the meeting + its action items', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([
      {
        id: MEETING_ID,
        brandId: BRAND_ID,
        date: '2026-04-18',
        title: 'Boudin QBR',
        attendees: ['Sara', 'Ryan', 'Ava'],
        attendeeUserIds: [USER_ID],
        summary: 'Checked usage.',
        rawNotes: 'Detailed notes…',
        decisions: ['Push the deck on Friday'],
        source: 'manual',
        externalMeetingId: null,
        recordingUrl: null,
        createdAt: new Date('2026-04-18T09:00:00.000Z'),
      },
    ]);
    mockDb._pushResult([
      {
        id: 'ai-1',
        text: 'Push the deck',
        status: 'open',
        assigneeId: USER_ID,
        dueDate: '2026-04-25',
      },
    ]);
    const ctx = makeCtx(mockDb);
    const result = await getMeeting.handler({ meetingId: MEETING_ID }, ctx);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(MEETING_ID);
    expect(result!.actionItems).toEqual([
      {
        id: 'ai-1',
        text: 'Push the deck',
        status: 'open',
        assigneeId: USER_ID,
        dueDate: '2026-04-25',
      },
    ]);
    expect(result!.decisions).toEqual(['Push the deck on Friday']);
    expect(result!.rawNotes).toBe('Detailed notes…');
  });

  it('returns null when the meeting does not exist', async () => {
    const mockDb = createMockDb();
    mockDb._pushResult([]);
    const ctx = makeCtx(mockDb);
    const result = await getMeeting.handler({ meetingId: MEETING_ID }, ctx);
    expect(result).toBeNull();
  });

  it('requires a valid meetingId UUID', () => {
    expect(() => getMeeting.inputSchema.parse({ meetingId: 'not-a-uuid' })).toThrow();
  });
});
