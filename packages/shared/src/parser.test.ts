import { describe, it, expect } from 'vitest';
import { parseQuickAdd, resolveDateToken, toLocalIsoDate } from './parser.ts';

describe('parseQuickAdd', () => {
  it('parses a plain title', () => {
    const r = parseQuickAdd('Buy domain');
    expect(r.title).toBe('Buy domain');
    expect(r.estimateMinutes).toBeNull();
    expect(r.roleTag).toBeNull();
    expect(r.priority).toBeNull();
    expect(r.dateToken).toBeNull();
  });

  it('parses minute estimate', () => {
    expect(parseQuickAdd('Buy domain ~30m').estimateMinutes).toBe(30);
  });

  it('parses hour estimate', () => {
    expect(parseQuickAdd('Write pitch deck ~2h').estimateMinutes).toBe(120);
  });

  it('parses role tag', () => {
    expect(parseQuickAdd('Email VC #strategy').roleTag).toBe('strategy');
  });

  it('parses priority', () => {
    expect(parseQuickAdd('Call lawyer !h').priority).toBe('high');
    expect(parseQuickAdd('Order snacks !l').priority).toBe('low');
    expect(parseQuickAdd('Clean inbox !m').priority).toBe('medium');
  });

  it('parses date token', () => {
    expect(parseQuickAdd('Ship update +tomorrow').dateToken).toBe('tomorrow');
  });

  it('is order-agnostic', () => {
    const a = parseQuickAdd('Buy domain ~30m #product !h +tomorrow');
    const b = parseQuickAdd('Buy domain +tomorrow !h #product ~30m');
    expect(a).toEqual(b);
  });

  it('leaves title clean when modifiers are interleaved', () => {
    const r = parseQuickAdd('Call   ~15m   investor   #strategy');
    expect(r.title).toBe('Call investor');
  });

  it('does not parse modifiers mid-word', () => {
    const r = parseQuickAdd('Review#product notes');
    expect(r.roleTag).toBeNull();
    expect(r.title).toBe('Review#product notes');
  });

  it('returns empty title for empty string', () => {
    const r = parseQuickAdd('');
    expect(r.title).toBe('');
    expect(r.estimateMinutes).toBeNull();
    expect(r.roleTag).toBeNull();
    expect(r.priority).toBeNull();
    expect(r.dateToken).toBeNull();
  });

  it('returns empty title when input is only modifiers', () => {
    const r = parseQuickAdd('~30m #product !h +tomorrow');
    expect(r.title).toBe('');
    expect(r.estimateMinutes).toBe(30);
    expect(r.roleTag).toBe('product');
    expect(r.priority).toBe('high');
    expect(r.dateToken).toBe('tomorrow');
  });

  it('parses ~0m as zero minutes', () => {
    expect(parseQuickAdd('Do nothing ~0m').estimateMinutes).toBe(0);
  });
});

describe('resolveDateToken', () => {
  const base = new Date(2026, 3, 13); // Mon Apr 13 2026

  it('returns null for unknown tokens', () => {
    expect(resolveDateToken('foo', base)).toBeNull();
  });

  it('resolves today', () => {
    expect(resolveDateToken('today', base)).toBe('2026-04-13');
  });

  it('resolves tomorrow', () => {
    expect(resolveDateToken('tomorrow', base)).toBe('2026-04-14');
  });

  it('resolves next weekday (future day this week)', () => {
    expect(resolveDateToken('fri', base)).toBe('2026-04-17');
  });

  it('resolves same weekday to 7 days later', () => {
    expect(resolveDateToken('mon', base)).toBe('2026-04-20');
  });

  it('resolves past weekday to next week', () => {
    expect(resolveDateToken('sun', base)).toBe('2026-04-19');
  });

  it('returns null for null input', () => {
    expect(resolveDateToken(null, base)).toBeNull();
  });

  it('resolves yesterday', () => {
    expect(resolveDateToken('yesterday', base)).toBe('2026-04-12');
  });

  it('resolves tmrw as tomorrow', () => {
    expect(resolveDateToken('tmrw', base)).toBe('2026-04-14');
  });

  it('resolves tom as tomorrow', () => {
    expect(resolveDateToken('tom', base)).toBe('2026-04-14');
  });

  it('resolves full weekday name monday', () => {
    expect(resolveDateToken('monday', base)).toBe('2026-04-20');
  });

  it('resolves full weekday name friday', () => {
    expect(resolveDateToken('friday', base)).toBe('2026-04-17');
  });
});

describe('toLocalIsoDate', () => {
  it('zero-pads month and day', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
