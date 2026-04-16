import { describe, it, expect } from 'vitest';
import { compareVersions, LATEST_VERSION, RELEASE_NOTES } from './releaseNotes';

describe('compareVersions', () => {
  it('returns -1 when a < b', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1);
  });

  it('returns 0 when equal', () => {
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0);
  });

  it('returns 1 when a > b', () => {
    expect(compareVersions('0.3.0', '0.2.0')).toBe(1);
  });

  it('compares numerically not lexicographically', () => {
    expect(compareVersions('0.10.0', '0.2.0')).toBe(1);
  });

  it('handles different segment lengths', () => {
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
  });

  it('compares minor correctly', () => {
    expect(compareVersions('0.3.0', '0.2.5')).toBe(1);
  });

  it('compares major correctly', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });
});

describe('RELEASE_NOTES integrity', () => {
  it('LATEST_VERSION equals the first entry version', () => {
    expect(LATEST_VERSION).toBe(RELEASE_NOTES[0]!.version);
  });

  it('entries are in descending version order', () => {
    for (let i = 0; i < RELEASE_NOTES.length - 1; i++) {
      const cmp = compareVersions(RELEASE_NOTES[i]!.version, RELEASE_NOTES[i + 1]!.version);
      expect(cmp).toBeGreaterThanOrEqual(1);
    }
  });

  it('all entries have valid YYYY-MM-DD date format', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('all entries have non-empty headline and summary', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.headline.length).toBeGreaterThan(0);
      expect(note.summary.length).toBeGreaterThan(0);
    }
  });

  it('all items have non-empty title and description', () => {
    for (const note of RELEASE_NOTES) {
      for (const item of note.items) {
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
      }
    }
  });
});
