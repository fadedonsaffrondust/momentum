import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { todayIso, tomorrowIso, isPast, isToday } from './date';

describe('date utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('todayIso returns current date', () => {
    expect(todayIso()).toBe('2026-04-15');
  });

  it('tomorrowIso returns next date', () => {
    expect(tomorrowIso()).toBe('2026-04-16');
  });

  it('isPast returns true for yesterday', () => {
    expect(isPast('2026-04-14')).toBe(true);
  });

  it('isPast returns false for today', () => {
    expect(isPast('2026-04-15')).toBe(false);
  });

  it('isPast returns false for tomorrow', () => {
    expect(isPast('2026-04-16')).toBe(false);
  });

  it('isToday returns true for today', () => {
    expect(isToday('2026-04-15')).toBe(true);
  });

  it('isToday returns false for yesterday', () => {
    expect(isToday('2026-04-14')).toBe(false);
  });

  it('isToday returns false for null', () => {
    expect(isToday(null)).toBe(false);
  });
});
