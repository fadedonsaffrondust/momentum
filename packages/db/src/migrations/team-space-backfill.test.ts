import { describe, it, expect } from 'vitest';
import { matchAttendeesToUsers, isSameIdSet } from './team-space-backfill.ts';

describe('matchAttendeesToUsers', () => {
  const users = [
    { id: 'user-nader', email: 'nader@omnirev.ai' },
    { id: 'user-sara', email: 'sara@omnirev.ai' },
    { id: 'user-ryan', email: 'ryan@omnirev.ai' },
  ];

  it('matches team emails and ignores non-team attendees', () => {
    const result = matchAttendeesToUsers(
      ['nader@omnirev.ai', 'client@external.com', 'sara@omnirev.ai'],
      users,
    );
    expect(result).toEqual(['user-nader', 'user-sara']);
  });

  it('is case-insensitive on the attendee email', () => {
    const result = matchAttendeesToUsers(['NADER@OMNIREV.AI', 'Sara@Omnirev.ai'], users);
    expect(result).toEqual(['user-nader', 'user-sara']);
  });

  it('is case-insensitive on the user email', () => {
    const result = matchAttendeesToUsers(
      ['nader@omnirev.ai'],
      [{ id: 'user-nader', email: 'Nader@Omnirev.AI' }],
    );
    expect(result).toEqual(['user-nader']);
  });

  it('deduplicates a user who appears multiple times in the attendee list', () => {
    const result = matchAttendeesToUsers(
      ['nader@omnirev.ai', 'NADER@omnirev.ai', 'nader@omnirev.ai'],
      users,
    );
    expect(result).toEqual(['user-nader']);
  });

  it('returns empty array when no attendees match', () => {
    const result = matchAttendeesToUsers(['client@external.com', 'guest@foo.io'], users);
    expect(result).toEqual([]);
  });

  it('preserves attendee order on first match', () => {
    const result = matchAttendeesToUsers(
      ['ryan@omnirev.ai', 'nader@omnirev.ai', 'sara@omnirev.ai'],
      users,
    );
    expect(result).toEqual(['user-ryan', 'user-nader', 'user-sara']);
  });

  it('returns empty when no users exist (fresh install pre-first-signup)', () => {
    const result = matchAttendeesToUsers(['anyone@omnirev.ai'], []);
    expect(result).toEqual([]);
  });
});

describe('isSameIdSet', () => {
  it('returns true for identical lists', () => {
    expect(isSameIdSet(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
  });

  it('returns true for same set in different order', () => {
    expect(isSameIdSet(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
  });

  it('returns false when sizes differ', () => {
    expect(isSameIdSet(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });

  it('returns false when elements differ at same size', () => {
    expect(isSameIdSet(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('returns true for two empty lists', () => {
    expect(isSameIdSet([], [])).toBe(true);
  });
});
