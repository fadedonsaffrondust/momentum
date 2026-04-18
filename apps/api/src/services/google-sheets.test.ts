import { describe, it, expect } from 'vitest';
import { parseSheetUrl, analyzeColumns, normalizeDate } from './google-sheets.js';

describe('parseSheetUrl', () => {
  it('extracts spreadsheetId from a standard URL', () => {
    const result = parseSheetUrl(
      'https://docs.google.com/spreadsheets/d/1J4GgqnxLJ_I8UkgCmN_mHYgdhIYWAcIXEIObolj7ciQ/edit',
    );
    expect(result).toEqual({
      spreadsheetId: '1J4GgqnxLJ_I8UkgCmN_mHYgdhIYWAcIXEIObolj7ciQ',
      gid: '0',
    });
  });

  it('extracts gid from URL with hash fragment', () => {
    const result = parseSheetUrl(
      'https://docs.google.com/spreadsheets/d/1abc123/edit#gid=456',
    );
    expect(result).toEqual({
      spreadsheetId: '1abc123',
      gid: '456',
    });
  });

  it('extracts gid from URL with query param', () => {
    const result = parseSheetUrl(
      'https://docs.google.com/spreadsheets/d/1abc123/edit?gid=789',
    );
    expect(result).toEqual({
      spreadsheetId: '1abc123',
      gid: '789',
    });
  });

  it('defaults gid to 0 when not present', () => {
    const result = parseSheetUrl(
      'https://docs.google.com/spreadsheets/d/1abc123/edit',
    );
    expect(result?.gid).toBe('0');
  });

  it('returns null for invalid URLs', () => {
    expect(parseSheetUrl('https://google.com')).toBeNull();
    expect(parseSheetUrl('not a url')).toBeNull();
    expect(parseSheetUrl('')).toBeNull();
  });

  it('handles URLs with hyphens and underscores in the ID', () => {
    const result = parseSheetUrl(
      'https://docs.google.com/spreadsheets/d/1a-b_c/edit',
    );
    expect(result?.spreadsheetId).toBe('1a-b_c');
  });
});

describe('analyzeColumns', () => {
  it('maps standard Momentum headers', () => {
    const result = analyzeColumns(['Date', 'Request', 'Response', 'Resolved']);
    expect(result).toEqual({ date: 0, request: 1, response: 2, resolved: 3 });
  });

  it('maps alternative header names (case-insensitive)', () => {
    const result = analyzeColumns(['DATE REQUESTED', 'Feature', 'Comment', 'Done']);
    expect(result).toEqual({ date: 0, request: 1, response: 2, resolved: 3 });
  });

  it('maps reordered columns', () => {
    const result = analyzeColumns(['Response', 'Resolved', 'Date', 'Request']);
    expect(result).toEqual({ date: 2, request: 3, response: 0, resolved: 1 });
  });

  it('handles extra columns (ignores them)', () => {
    const result = analyzeColumns(['Date', 'Priority', 'Request', 'Response', 'Notes', 'Resolved']);
    expect(result).toEqual({ date: 0, request: 2, response: 3, resolved: 5 });
  });

  it('matches "question" as request', () => {
    const result = analyzeColumns(['Date', 'Question', 'Reply', 'Status']);
    expect(result).toEqual({ date: 0, request: 1, response: 2, resolved: 3 });
  });

  it('matches "omnirev" as response', () => {
    const result = analyzeColumns(['Date', 'Ask', 'Omnirev', 'Complete']);
    expect(result).toEqual({ date: 0, request: 1, response: 2, resolved: 3 });
  });

  it('matches plural headers (Questions, Responses, etc.)', () => {
    const result = analyzeColumns(['Date Requested', 'Omni Rev Questions', 'Responses', 'Completed']);
    expect(result).toEqual({ date: 0, request: 1, response: 2, resolved: 3 });
  });

  it('matches "Omni Rev" as two words for response', () => {
    const result = analyzeColumns(['Date', 'Feature Request', 'Omni Rev', 'Resolved']);
    expect(result).toEqual({ date: 0, request: 1, response: 2, resolved: 3 });
  });

  it('returns null when a required column is missing', () => {
    expect(analyzeColumns(['Date', 'Request', 'Resolved'])).toBeNull();
    expect(analyzeColumns(['Date', 'Request'])).toBeNull();
    expect(analyzeColumns([])).toBeNull();
  });

  it('does not double-assign the same column', () => {
    const result = analyzeColumns(['Date Requested', 'Request', 'Response', 'Resolved']);
    expect(result).toEqual({ date: 0, request: 1, response: 2, resolved: 3 });
    expect(new Set(Object.values(result!)).size).toBe(4);
  });
});

describe('normalizeDate', () => {
  it('passes through YYYY/MM/DD unchanged', () => {
    expect(normalizeDate('2026/04/14')).toBe('2026/04/14');
  });

  it('converts YYYY-MM-DD to YYYY/MM/DD', () => {
    expect(normalizeDate('2026-04-14')).toBe('2026/04/14');
  });

  it('normalizes verbose date strings', () => {
    expect(normalizeDate('April 14, 2026')).toBe('2026/04/14');
  });

  it('normalizes short date formats', () => {
    expect(normalizeDate('4/9/2026')).toBe('2026/04/09');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate('  ')).toBe('');
  });

  it('returns original string for unparseable dates', () => {
    expect(normalizeDate('not-a-date')).toBe('not-a-date');
  });

  it('trims whitespace', () => {
    expect(normalizeDate('  2026/04/14  ')).toBe('2026/04/14');
  });
});
