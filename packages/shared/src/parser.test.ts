import { describe, it, expect } from 'vitest';
import { parseQuickAdd, resolveDateToken, resolveAssigneeToken, toLocalIsoDate } from './parser.ts';

describe('parseQuickAdd', () => {
  it('parses a plain title', () => {
    const r = parseQuickAdd('Buy domain');
    expect(r.title).toBe('Buy domain');
    expect(r.estimateMinutes).toBeNull();
    expect(r.roleTag).toBeNull();
    expect(r.priority).toBeNull();
    expect(r.dateToken).toBeNull();
    expect(r.assigneeToken).toBeNull();
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
    expect(r.assigneeToken).toBeNull();
  });

  it('parses @username assignee token', () => {
    expect(parseQuickAdd('Review proposal @sara').assigneeToken).toBe('sara');
  });

  it('lowercases @Username for case-insensitive resolution', () => {
    expect(parseQuickAdd('Ping @Alice').assigneeToken).toBe('alice');
  });

  it('does not treat bare @ mid-word as a token', () => {
    const r = parseQuickAdd('email foo@bar.com');
    expect(r.assigneeToken).toBeNull();
    expect(r.title).toBe('email foo@bar.com');
  });

  it('strips the @token from the title', () => {
    const r = parseQuickAdd('Review proposal @sara');
    expect(r.title).toBe('Review proposal');
  });

  it('coexists with other modifiers — @alice before #product', () => {
    const r = parseQuickAdd('Review proposal @alice #product');
    expect(r.assigneeToken).toBe('alice');
    expect(r.roleTag).toBe('product');
    expect(r.title).toBe('Review proposal');
  });

  it('coexists with other modifiers — #alice before @product would be a role tag', () => {
    // `#alice` is parsed as role tag first; `@product` is parsed as assignee token.
    const r = parseQuickAdd('Review #alice @product');
    expect(r.roleTag).toBe('alice');
    expect(r.assigneeToken).toBe('product');
    expect(r.title).toBe('Review');
  });

  it('only captures the first @ token', () => {
    const r = parseQuickAdd('Review @sara @ryan');
    expect(r.assigneeToken).toBe('sara');
    // the second @ryan stays in the title
    expect(r.title).toBe('Review @ryan');
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

describe('resolveAssigneeToken', () => {
  const UUID_NADER = '11111111-1111-1111-1111-111111111111';
  const UUID_SARA = '22222222-2222-2222-2222-222222222222';
  const UUID_RYAN = '33333333-3333-3333-3333-333333333333';

  const users = [
    { id: UUID_NADER, displayName: 'Nader Samadyan' },
    { id: UUID_SARA, displayName: 'Sara Pourmir' },
    { id: UUID_RYAN, displayName: 'Ryan Ghaffari' },
  ];

  it('returns null for null token', () => {
    expect(resolveAssigneeToken(null, users)).toBeNull();
  });

  it('resolves first-name match', () => {
    expect(resolveAssigneeToken('sara', users)).toBe(UUID_SARA);
  });

  it('first-name match is case-insensitive', () => {
    expect(resolveAssigneeToken('SARA', users)).toBe(UUID_SARA);
    expect(resolveAssigneeToken('Nader', users)).toBe(UUID_NADER);
  });

  it('resolves full display name (lowercased) when first name does not match', () => {
    // synthetic case: token matches only the full name string
    expect(resolveAssigneeToken('nadersamadyan', [{ id: 'x', displayName: 'NaderSamadyan' }])).toBe(
      'x',
    );
  });

  it('prefers first-name over later full-name match', () => {
    // Two users share first name "Sam"; first-name match wins for the first entry.
    const pool = [
      { id: 'first', displayName: 'Sam One' },
      { id: 'second', displayName: 'Sam Two' },
    ];
    expect(resolveAssigneeToken('sam', pool)).toBe('first');
  });

  it('returns null when no match', () => {
    expect(resolveAssigneeToken('nonexistent', users)).toBeNull();
  });

  it('handles empty user list', () => {
    expect(resolveAssigneeToken('sara', [])).toBeNull();
  });
});
