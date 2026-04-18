import { describe, it, expect } from 'vitest';
import { matchAttendeeUserIds } from './attendees.ts';

const UUID_NADER = '11111111-1111-1111-1111-111111111111';
const UUID_SARA = '22222222-2222-2222-2222-222222222222';
const UUID_RYAN = '33333333-3333-3333-3333-333333333333';

const team = [
  { id: UUID_NADER, email: 'nader@omnirev.ai' },
  { id: UUID_SARA, email: 'sara@omnirev.ai' },
  { id: UUID_RYAN, email: 'ryan@omnirev.ai' },
];

describe('matchAttendeeUserIds', () => {
  it('matches emails to users', () => {
    expect(matchAttendeeUserIds(['nader@omnirev.ai', 'sara@omnirev.ai'], team)).toEqual([
      UUID_NADER,
      UUID_SARA,
    ]);
  });

  it('ignores plain-name entries (no @ sign)', () => {
    expect(matchAttendeeUserIds(['Nader Samadyan', 'Sara'], team)).toEqual([]);
  });

  it('ignores malformed email-like strings', () => {
    expect(matchAttendeeUserIds(['nader@', '@omnirev.ai', 'foo@bar'], team)).toEqual([]);
  });

  it('is case-insensitive on the attendee side', () => {
    expect(matchAttendeeUserIds(['NADER@OMNIREV.AI', 'Sara@Omnirev.AI'], team)).toEqual([
      UUID_NADER,
      UUID_SARA,
    ]);
  });

  it('is case-insensitive on the team-user side', () => {
    expect(
      matchAttendeeUserIds(['nader@omnirev.ai'], [
        { id: UUID_NADER, email: 'Nader@OMNIREV.ai' },
      ]),
    ).toEqual([UUID_NADER]);
  });

  it('mixes emails and names, skipping non-email entries', () => {
    const result = matchAttendeeUserIds(
      ['Alice Wonderland', 'sara@omnirev.ai', 'external@client.com', 'ryan@omnirev.ai'],
      team,
    );
    expect(result).toEqual([UUID_SARA, UUID_RYAN]);
  });

  it('deduplicates', () => {
    expect(
      matchAttendeeUserIds(
        ['nader@omnirev.ai', 'Nader@omnirev.ai', 'nader@omnirev.ai'],
        team,
      ),
    ).toEqual([UUID_NADER]);
  });

  it('preserves first-match order', () => {
    const result = matchAttendeeUserIds(
      ['ryan@omnirev.ai', 'nader@omnirev.ai', 'sara@omnirev.ai'],
      team,
    );
    expect(result).toEqual([UUID_RYAN, UUID_NADER, UUID_SARA]);
  });

  it('returns empty for an empty attendee list', () => {
    expect(matchAttendeeUserIds([], team)).toEqual([]);
  });

  it('returns empty when no users exist', () => {
    expect(matchAttendeeUserIds(['nader@omnirev.ai'], [])).toEqual([]);
  });

  it('trims whitespace before matching', () => {
    expect(matchAttendeeUserIds(['  nader@omnirev.ai  '], team)).toEqual([UUID_NADER]);
  });
});
