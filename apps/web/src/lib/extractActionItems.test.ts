import { describe, it, expect } from 'vitest';
import { extractActionItems } from './extractActionItems';

describe('extractActionItems', () => {
  it('extracts arrow pattern', () => {
    expect(extractActionItems('→ Call client')).toEqual(['Call client']);
  });

  it('trims extra whitespace in arrow pattern', () => {
    expect(extractActionItems('→   Call  client  ')).toEqual(['Call  client']);
  });

  it('extracts /todo pattern', () => {
    expect(extractActionItems('/todo Follow up with client')).toEqual(['Follow up with client']);
  });

  it('extracts /todo case insensitive', () => {
    expect(extractActionItems('/TODO Send report')).toEqual(['Send report']);
  });

  it('does not extract /todo without content', () => {
    expect(extractActionItems('/todo')).toEqual([]);
  });

  it('extracts checkbox pattern', () => {
    expect(extractActionItems('- [ ] Send invoice')).toEqual(['Send invoice']);
  });

  it('extracts checkbox with extra spaces inside brackets', () => {
    expect(extractActionItems('- [  ] Send invoice')).toEqual(['Send invoice']);
  });

  it('extracts "Action Items:" heading', () => {
    expect(extractActionItems('Action Items: Fix the bug')).toEqual(['Fix the bug']);
  });

  it('extracts singular "action item:"', () => {
    expect(extractActionItems('action item: Review PR')).toEqual(['Review PR']);
  });

  it('extracts "Next Steps:" heading', () => {
    expect(extractActionItems('Next Steps: Deploy v2')).toEqual(['Deploy v2']);
  });

  it('extracts singular "next step:"', () => {
    expect(extractActionItems('next step: Call team')).toEqual(['Call team']);
  });

  it('extracts "To Do:" heading', () => {
    expect(extractActionItems('To Do: Write tests')).toEqual(['Write tests']);
  });

  it('extracts mixed patterns in multiline input', () => {
    const input = '→ First item\n- [ ] Second item\nAction Items: Third item';
    expect(extractActionItems(input)).toEqual(['First item', 'Second item', 'Third item']);
  });

  it('skips non-matching lines', () => {
    expect(extractActionItems('Just a regular note\n→ Real item')).toEqual(['Real item']);
  });

  it('returns empty array for empty input', () => {
    expect(extractActionItems('')).toEqual([]);
  });

  it('returns empty array for whitespace-only lines', () => {
    expect(extractActionItems('  \n  \n  ')).toEqual([]);
  });

  it('extracts all matches with multiple blank lines between them', () => {
    const input = '→ First\n\n\n\n→ Second';
    expect(extractActionItems(input)).toEqual(['First', 'Second']);
  });

  it('is case insensitive for keyword patterns', () => {
    expect(extractActionItems('ACTION ITEMS: uppercase')).toEqual(['uppercase']);
  });
});
