import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatMinutes, formatTimeAgo, formatDateShort } from './format';

describe('formatMinutes', () => {
  it('returns dash for null', () => {
    expect(formatMinutes(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatMinutes(undefined)).toBe('—');
  });

  it('returns dash for 0', () => {
    expect(formatMinutes(0)).toBe('—');
  });

  it('formats minutes only for < 60', () => {
    expect(formatMinutes(30)).toBe('30m');
  });

  it('formats 59 minutes', () => {
    expect(formatMinutes(59)).toBe('59m');
  });

  it('formats exact hours', () => {
    expect(formatMinutes(60)).toBe('1h');
  });

  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('formats 2 exact hours', () => {
    expect(formatMinutes(120)).toBe('2h');
  });

  it('formats 2h 30m', () => {
    expect(formatMinutes(150)).toBe('2h 30m');
  });
});

describe('formatTimeAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for the same time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    expect(formatTimeAgo('2026-04-15T12:00:00Z')).toBe('just now');
  });

  it('returns "just now" for 30 seconds ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    expect(formatTimeAgo('2026-04-15T11:59:30Z')).toBe('just now');
  });

  it('returns minutes ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    expect(formatTimeAgo('2026-04-15T11:58:00Z')).toBe('2m ago');
  });

  it('returns 59m ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    expect(formatTimeAgo('2026-04-15T11:01:00Z')).toBe('59m ago');
  });

  it('returns hours ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    expect(formatTimeAgo('2026-04-15T11:00:00Z')).toBe('1h ago');
  });

  it('returns 23h ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    expect(formatTimeAgo('2026-04-14T13:00:00Z')).toBe('23h ago');
  });

  it('returns days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    expect(formatTimeAgo('2026-04-13T12:00:00Z')).toBe('2d ago');
  });
});

describe('formatDateShort', () => {
  it('contains the day number and month abbreviation', () => {
    const result = formatDateShort('2026-04-15');
    expect(result).toContain('15');
    expect(result).toContain('Apr');
  });
});
