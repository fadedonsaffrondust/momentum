import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd, resolveDateToken, toLocalIsoDate } from './parser.ts';

describe('parseQuickAdd', () => {
  it('parses a plain title', () => {
    const r = parseQuickAdd('Buy domain');
    assert.equal(r.title, 'Buy domain');
    assert.equal(r.estimateMinutes, null);
    assert.equal(r.roleTag, null);
    assert.equal(r.priority, null);
    assert.equal(r.dateToken, null);
  });

  it('parses minute estimate', () => {
    assert.equal(parseQuickAdd('Buy domain ~30m').estimateMinutes, 30);
  });

  it('parses hour estimate', () => {
    assert.equal(parseQuickAdd('Write pitch deck ~2h').estimateMinutes, 120);
  });

  it('parses role tag', () => {
    assert.equal(parseQuickAdd('Email VC #strategy').roleTag, 'strategy');
  });

  it('parses priority', () => {
    assert.equal(parseQuickAdd('Call lawyer !h').priority, 'high');
    assert.equal(parseQuickAdd('Order snacks !l').priority, 'low');
    assert.equal(parseQuickAdd('Clean inbox !m').priority, 'medium');
  });

  it('parses date token', () => {
    assert.equal(parseQuickAdd('Ship update +tomorrow').dateToken, 'tomorrow');
  });

  it('is order-agnostic', () => {
    const a = parseQuickAdd('Buy domain ~30m #product !h +tomorrow');
    const b = parseQuickAdd('Buy domain +tomorrow !h #product ~30m');
    assert.deepEqual(a, b);
  });

  it('leaves title clean when modifiers are interleaved', () => {
    const r = parseQuickAdd('Call   ~15m   investor   #strategy');
    assert.equal(r.title, 'Call investor');
  });

  it('does not parse modifiers mid-word', () => {
    const r = parseQuickAdd('Review#product notes');
    assert.equal(r.roleTag, null);
    assert.equal(r.title, 'Review#product notes');
  });
});

describe('resolveDateToken', () => {
  const base = new Date(2026, 3, 13); // Mon Apr 13 2026

  it('returns null for unknown tokens', () => {
    assert.equal(resolveDateToken('foo', base), null);
  });

  it('resolves today', () => {
    assert.equal(resolveDateToken('today', base), '2026-04-13');
  });

  it('resolves tomorrow', () => {
    assert.equal(resolveDateToken('tomorrow', base), '2026-04-14');
  });

  it('resolves next weekday (future day this week)', () => {
    assert.equal(resolveDateToken('fri', base), '2026-04-17');
  });

  it('resolves same weekday to 7 days later', () => {
    assert.equal(resolveDateToken('mon', base), '2026-04-20');
  });

  it('resolves past weekday to next week', () => {
    assert.equal(resolveDateToken('sun', base), '2026-04-19');
  });
});

describe('toLocalIsoDate', () => {
  it('zero-pads month and day', () => {
    assert.equal(toLocalIsoDate(new Date(2026, 0, 5)), '2026-01-05');
  });
});
