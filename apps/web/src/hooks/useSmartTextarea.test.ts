import { describe, it, expect } from 'vitest';
import { handleEnterKey, handleTabKey, handleSpaceKey } from './useSmartTextarea';

describe('handleEnterKey', () => {
  it('continues bullet list on non-empty bullet line', () => {
    const text = '- first item';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: '- first item\n- ', newCursor: 15 });
  });

  it('preserves indentation on bullet continuation', () => {
    const text = '  - nested item';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: '  - nested item\n  - ', newCursor: 20 });
  });

  it('exits bullet list on empty bullet line', () => {
    const text = '- first\n- ';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: '- first\n', newCursor: 8 });
  });

  it('exits indented bullet list on empty indented bullet line', () => {
    const text = '- top\n  - ';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: '- top\n', newCursor: 6 });
  });

  it('continues numbered list with incremented number', () => {
    const text = '1. first item';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: '1. first item\n2. ', newCursor: 17 });
  });

  it('continues numbered list preserving indent', () => {
    const text = '  3. nested item';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: '  3. nested item\n  4. ', newCursor: 22 });
  });

  it('exits numbered list on empty numbered line', () => {
    const text = '1. first\n2. ';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: '1. first\n', newCursor: 9 });
  });

  it('returns null for plain line with no list marker', () => {
    const result = handleEnterKey('hello world', 11);
    expect(result).toBeNull();
  });

  it('returns null when cursor is in middle of line content', () => {
    const text = '- some content here';
    const result = handleEnterKey(text, 7); // cursor after "some"
    expect(result).toBeNull();
  });

  it('expands /todo before Enter', () => {
    const text = '/todo';
    const result = handleEnterKey(text, 5);
    expect(result).toEqual({ newText: '→ ', newCursor: 2 });
  });

  it('expands /todo mid-line with preceding space', () => {
    const text = 'notes /todo';
    const result = handleEnterKey(text, 11);
    expect(result).toEqual({ newText: 'notes → ', newCursor: 8 });
  });

  it('does not expand /todo preceded by non-whitespace without space', () => {
    const text = 'info/todo';
    // The regex (?:^|\s)/todo$ won't match "info/todo" — there's no whitespace before /todo
    const result = handleEnterKey(text, 9);
    expect(result).toBeNull();
  });

  it('handles large numbered list continuation', () => {
    const text = '999. item';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: '999. item\n1000. ', newCursor: 16 });
  });

  it('continues bullet after multiline text', () => {
    const text = 'paragraph\n- item one';
    const result = handleEnterKey(text, text.length);
    expect(result).toEqual({ newText: 'paragraph\n- item one\n- ', newCursor: 23 });
  });
});

describe('handleTabKey', () => {
  it('indents current line by 2 spaces', () => {
    const text = '- item';
    const result = handleTabKey(text, 3, 3, false);
    expect(result.newText).toBe('  - item');
    expect(result.newCursor).toBe(5);
  });

  it('dedents current line by 2 spaces', () => {
    const text = '  - item';
    const result = handleTabKey(text, 5, 5, true);
    expect(result.newText).toBe('- item');
    expect(result.newCursor).toBe(3);
  });

  it('does not dedent past column 0', () => {
    const text = '- item';
    const result = handleTabKey(text, 3, 3, true);
    expect(result.newText).toBe('- item');
    expect(result.newCursor).toBe(3);
  });

  it('does not dedent with only 1 leading space', () => {
    const text = ' - item';
    const result = handleTabKey(text, 4, 4, true);
    expect(result.newText).toBe(' - item');
    expect(result.newCursor).toBe(4);
  });

  it('handles multi-line selection indent', () => {
    const text = '- one\n- two\n- three';
    const result = handleTabKey(text, 0, text.length, false);
    expect(result.newText).toBe('  - one\n  - two\n  - three');
    expect(result.newCursor).toBe(2);
    expect(result.newSelectionEnd).toBe(text.length + 6);
  });

  it('handles multi-line selection dedent', () => {
    const text = '  - one\n  - two\n  - three';
    const result = handleTabKey(text, 0, text.length, true);
    expect(result.newText).toBe('- one\n- two\n- three');
    expect(result.newCursor).toBe(0);
    expect(result.newSelectionEnd).toBe(text.length - 6);
  });

  it('indents line in middle of text', () => {
    const text = 'line1\nline2\nline3';
    const cursor = 8; // middle of line2
    const result = handleTabKey(text, cursor, cursor, false);
    expect(result.newText).toBe('line1\n  line2\nline3');
    expect(result.newCursor).toBe(10);
  });
});

describe('handleSpaceKey', () => {
  it('expands /todo followed by space', () => {
    const text = '/todo';
    const result = handleSpaceKey(text, 5);
    expect(result).toEqual({ newText: '→ ', newCursor: 2 });
  });

  it('expands /todo at start of line after newline', () => {
    const text = 'notes\n/todo';
    const result = handleSpaceKey(text, 11);
    expect(result).toEqual({ newText: 'notes\n→ ', newCursor: 8 });
  });

  it('expands /todo preceded by space', () => {
    const text = 'check /todo';
    const result = handleSpaceKey(text, 11);
    expect(result).toEqual({ newText: 'check → ', newCursor: 8 });
  });

  it('does not expand /todo preceded by non-whitespace', () => {
    const text = 'info/todo';
    const result = handleSpaceKey(text, 9);
    expect(result).toBeNull();
  });

  it('returns null when no /todo present', () => {
    const result = handleSpaceKey('hello world', 11);
    expect(result).toBeNull();
  });

  it('returns null when text is too short for /todo', () => {
    const result = handleSpaceKey('todo', 4);
    expect(result).toBeNull();
  });
});
