import { describe, it, expect, vi } from 'vitest';
import type { BrandMeeting, BrandActionItem } from '@momentum/shared';

vi.mock('../lib/date', () => ({
  todayIso: () => '2026-04-15',
}));

import { computeBrandHealth } from './useBrandHealth';

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const DATETIME = '2026-04-15T00:00:00.000Z';

function makeMeeting(overrides: Partial<BrandMeeting> = {}): BrandMeeting {
  return {
    id: UUID,
    brandId: UUID,
    userId: UUID,
    date: '2026-04-10',
    title: 'Weekly sync',
    attendees: [],
    summary: null,
    rawNotes: '',
    decisions: [],
    source: 'manual',
    externalMeetingId: null,
    recordingUrl: null,
    createdAt: DATETIME,
    ...overrides,
  };
}

function makeActionItem(overrides: Partial<BrandActionItem> = {}): BrandActionItem {
  return {
    id: UUID,
    brandId: UUID,
    meetingId: null,
    userId: UUID,
    text: 'Follow up',
    status: 'open',
    owner: null,
    dueDate: null,
    linkedTaskId: null,
    meetingDate: null,
    createdAt: DATETIME,
    completedAt: null,
    ...overrides,
  };
}

describe('computeBrandHealth', () => {
  it('returns needs_attention when there is an overdue item', () => {
    const items = [makeActionItem({ dueDate: '2026-04-10', status: 'open' })];
    expect(computeBrandHealth([], items)).toBe('needs_attention');
  });

  it('returns needs_attention when there are more than 5 open items', () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      makeActionItem({ id: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a${String(i).padStart(2, '0')}` }),
    );
    const meetings = [makeMeeting({ date: '2026-04-10' })];
    expect(computeBrandHealth(meetings, items)).toBe('needs_attention');
  });

  it('returns needs_attention when there are no meetings but open items exist', () => {
    const items = [makeActionItem()];
    expect(computeBrandHealth([], items)).toBe('needs_attention');
  });

  it('returns needs_attention when last meeting was more than 30 days ago', () => {
    const meetings = [makeMeeting({ date: '2026-03-14' })];
    expect(computeBrandHealth(meetings, [])).toBe('needs_attention');
  });

  it('returns quiet when no meetings and no open items', () => {
    expect(computeBrandHealth([], [])).toBe('quiet');
  });

  it('returns quiet when last meeting was 15-20 days ago with 2 open items', () => {
    const meetings = [makeMeeting({ date: '2026-03-28' })];
    const items = [
      makeActionItem({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' }),
      makeActionItem({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02' }),
    ];
    expect(computeBrandHealth(meetings, items)).toBe('quiet');
  });

  it('returns quiet when recent meeting but 4 open items (> 3 but <= 5)', () => {
    const meetings = [makeMeeting({ date: '2026-04-10' })];
    const items = Array.from({ length: 4 }, (_, i) =>
      makeActionItem({ id: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a${String(i).padStart(2, '0')}` }),
    );
    expect(computeBrandHealth(meetings, items)).toBe('quiet');
  });

  it('returns on_track with recent meeting and 2 open items', () => {
    const meetings = [makeMeeting({ date: '2026-04-10' })];
    const items = [
      makeActionItem({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' }),
      makeActionItem({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02' }),
    ];
    expect(computeBrandHealth(meetings, items)).toBe('on_track');
  });

  it('returns on_track with recent meeting and 0 open items', () => {
    const meetings = [makeMeeting({ date: '2026-04-10' })];
    expect(computeBrandHealth(meetings, [])).toBe('on_track');
  });
});
