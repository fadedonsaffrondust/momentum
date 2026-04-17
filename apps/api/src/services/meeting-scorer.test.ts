import { describe, it, expect } from 'vitest';
import type { SyncMatchRules } from '@momentum/shared';
import type { TldvMeeting } from './tldv.ts';
import { scoreMeeting, categorizeCandidates } from './meeting-scorer.ts';

function makeMeeting(overrides: Partial<TldvMeeting> = {}): TldvMeeting {
  return {
    id: 'meeting-1',
    name: 'Weekly Sync',
    happenedAt: '2026-04-15T15:00:00.000Z',
    invitees: [{ name: 'Alice', email: 'alice@example.com' }],
    organizer: { name: 'Bob', email: 'bob@example.com' },
    url: 'https://tldv.io/app/meetings/meeting-1',
    ...overrides,
  };
}

const baseRules: SyncMatchRules = {
  stakeholderEmails: [],
  titleKeywords: [],
  meetingType: 'external',
  syncWindowDays: 30,
};

describe('scoreMeeting', () => {
  it('returns -1000 for already-synced meetings', () => {
    const result = scoreMeeting(makeMeeting(), baseRules, ['meeting-1']);
    expect(result.score).toBe(-1000);
    expect(result.reasons).toContain('Already synced');
  });

  it('scores +50 per stakeholder email match in invitees', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['alice@example.com'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(50);
    expect(result.hasStakeholderMatch).toBe(true);
    expect(result.reasons.some((r) => r.includes('Alice'))).toBe(true);
  });

  it('scores +50 for stakeholder email match in organizer', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['bob@example.com'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(50);
    expect(result.hasStakeholderMatch).toBe(true);
  });

  it('scores +50 per match for multiple stakeholder emails', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['alice@example.com', 'bob@example.com'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(100);
  });

  it('email matching is case-insensitive', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['ALICE@EXAMPLE.COM'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(50);
    expect(result.hasStakeholderMatch).toBe(true);
  });

  it('scores +30 per title keyword match', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      titleKeywords: ['Weekly'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(30);
    expect(result.reasons.some((r) => r.includes('Weekly'))).toBe(true);
  });

  it('title keyword matching is case-insensitive', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      titleKeywords: ['weekly sync'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(30);
  });

  it('scores +30 per keyword for multiple keyword matches', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      titleKeywords: ['Weekly', 'Sync'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(60);
  });

  it('combines email and keyword scoring', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['alice@example.com'],
      titleKeywords: ['Weekly'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(80);
    expect(result.hasStakeholderMatch).toBe(true);
  });

  it('hasStakeholderMatch is false when no emails configured', () => {
    const result = scoreMeeting(makeMeeting(), baseRules, []);
    expect(result.hasStakeholderMatch).toBe(false);
  });

  it('hasStakeholderMatch is false when emails configured but none match', () => {
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['nobody@example.com'],
    };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.hasStakeholderMatch).toBe(false);
  });

  it('ignores empty title keywords', () => {
    const rules: SyncMatchRules = { ...baseRules, titleKeywords: [''] };
    const result = scoreMeeting(makeMeeting(), rules, []);
    expect(result.score).toBe(0);
  });
});

describe('categorizeCandidates', () => {
  it('puts stakeholder matches in likely', () => {
    const meetings = [
      makeMeeting({ id: 'match', invitees: [{ name: 'Stakeholder', email: 'stakeholder@test.com' }] }),
    ];
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['stakeholder@test.com'],
    };

    const result = categorizeCandidates(meetings, rules, []);

    expect(result.likely.length).toBe(1);
    expect(result.likely[0]!.meeting.id).toBe('match');
    expect(result.likely[0]!.confidence).toBe('high');
    expect(result.possible.length).toBe(0);
  });

  it('shows keyword-only matches as possible even when emails are configured', () => {
    const meetings = [
      makeMeeting({ id: 'email-match', invitees: [{ name: 'S', email: 's@test.com' }] }),
      makeMeeting({ id: 'keyword-match', name: 'Acme Review', invitees: [{ name: 'Other', email: 'other@test.com' }] }),
      makeMeeting({ id: 'no-match', name: 'Random Call', invitees: [{ name: 'Other', email: 'other@test.com' }] }),
    ];
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['s@test.com'],
      titleKeywords: ['Acme'],
    };

    const result = categorizeCandidates(meetings, rules, []);

    expect(result.likely.length).toBe(1);
    expect(result.likely[0]!.meeting.id).toBe('email-match');
    expect(result.possible.length).toBe(1);
    expect(result.possible[0]!.meeting.id).toBe('keyword-match');
  });

  it('shows keyword-only matches as possible when no emails configured', () => {
    const meetings = [makeMeeting({ id: 'title-match', name: 'Acme Review' })];
    const rules: SyncMatchRules = {
      ...baseRules,
      titleKeywords: ['Acme'],
    };

    const result = categorizeCandidates(meetings, rules, []);

    expect(result.likely.length).toBe(0);
    expect(result.possible.length).toBe(1);
    expect(result.possible[0]!.confidence).toBe('low');
  });

  it('excludes already-synced meetings', () => {
    const meetings = [
      makeMeeting({ id: 'synced', invitees: [{ name: 'S', email: 's@test.com' }] }),
    ];
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['s@test.com'],
    };

    const result = categorizeCandidates(meetings, rules, ['synced']);

    expect(result.likely.length).toBe(0);
    expect(result.possible.length).toBe(0);
  });

  it('sorts each bucket by score descending', () => {
    const meetings = [
      makeMeeting({ id: 'a', invitees: [{ name: 'S1', email: 's1@test.com' }] }),
      makeMeeting({
        id: 'b',
        invitees: [
          { name: 'S1', email: 's1@test.com' },
          { name: 'S2', email: 's2@test.com' },
        ],
      }),
    ];
    const rules: SyncMatchRules = {
      ...baseRules,
      stakeholderEmails: ['s1@test.com', 's2@test.com'],
    };

    const result = categorizeCandidates(meetings, rules, []);

    expect(result.likely[0]!.meeting.id).toBe('b');
    expect(result.likely[1]!.meeting.id).toBe('a');
  });

  it('returns empty when no rules match anything', () => {
    const meetings = [makeMeeting()];
    const result = categorizeCandidates(meetings, baseRules, []);
    expect(result.likely.length).toBe(0);
    expect(result.possible.length).toBe(0);
  });
});
