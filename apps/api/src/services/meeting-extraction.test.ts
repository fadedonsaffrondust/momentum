import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TldvSentence, TldvHighlight } from './tldv.ts';
import {
  buildExtractionPrompt,
  buildDeduplicationPrompt,
  deduplicateActionItems,
} from './meeting-extraction.ts';

describe('buildExtractionPrompt', () => {
  const stakeholders = [
    { name: 'Danna', role: 'VP Marketing' },
    { name: 'Steve', role: null },
  ];

  const invitees = [
    { name: 'Danna Smith', email: 'danna@brand.com' },
    { name: 'Bob', email: 'bob@company.com' },
  ];

  const sentences: TldvSentence[] = [
    { speaker: 'Danna', text: 'Hello everyone', startTime: 0, endTime: 3 },
    { speaker: 'Bob', text: 'Hi there, lets discuss the plan', startTime: 4, endTime: 10 },
  ];

  const highlights: TldvHighlight[] = [
    {
      text: 'Team agreed on Q3 strategy',
      startTime: 120,
      source: 'auto',
      topic: { title: 'Strategy', summary: 'No Summary' },
    },
  ];

  it('includes brand name', () => {
    const prompt = buildExtractionPrompt(
      'Acme Corp',
      stakeholders,
      invitees,
      sentences,
      highlights,
    );
    expect(prompt).toContain('Brand: Acme Corp');
  });

  it('includes stakeholder names and roles', () => {
    const prompt = buildExtractionPrompt('Acme', stakeholders, invitees, sentences, highlights);
    expect(prompt).toContain('Danna (VP Marketing)');
    expect(prompt).toContain('Steve');
  });

  it('includes invitees with emails', () => {
    const prompt = buildExtractionPrompt('Acme', stakeholders, invitees, sentences, highlights);
    expect(prompt).toContain('Danna Smith <danna@brand.com>');
    expect(prompt).toContain('Bob <bob@company.com>');
  });

  it('includes transcript in speaker: text format', () => {
    const prompt = buildExtractionPrompt('Acme', stakeholders, invitees, sentences, highlights);
    expect(prompt).toContain('Danna: Hello everyone');
    expect(prompt).toContain('Bob: Hi there, lets discuss the plan');
  });

  it('includes highlights with topic titles', () => {
    const prompt = buildExtractionPrompt('Acme', stakeholders, invitees, sentences, highlights);
    expect(prompt).toContain('[Strategy] Team agreed on Q3 strategy');
  });

  it('handles empty transcript', () => {
    const prompt = buildExtractionPrompt('Acme', stakeholders, invitees, [], highlights);
    expect(prompt).toContain('(No transcript available)');
  });

  it('handles empty highlights', () => {
    const prompt = buildExtractionPrompt('Acme', stakeholders, invitees, sentences, []);
    expect(prompt).toContain('(No highlights available)');
  });

  it('handles empty stakeholders', () => {
    const prompt = buildExtractionPrompt('Acme', [], invitees, sentences, highlights);
    expect(prompt).toContain('(none configured)');
  });

  it('handles empty invitees', () => {
    const prompt = buildExtractionPrompt('Acme', stakeholders, [], sentences, highlights);
    expect(prompt).toContain('(none)');
  });

  it('truncates very long transcripts', () => {
    const longSentences: TldvSentence[] = [];
    for (let i = 0; i < 5000; i++) {
      longSentences.push({
        speaker: 'Speaker',
        text: 'A'.repeat(50),
        startTime: i * 2,
        endTime: i * 2 + 1,
      });
    }

    const prompt = buildExtractionPrompt('Acme', [], [], longSentences, []);
    expect(prompt).toContain('[... transcript truncated for length ...]');
    expect(prompt.length).toBeLessThanOrEqual(100_000);
  });
});

describe('buildDeduplicationPrompt', () => {
  it('formats extracted items with index and owner', () => {
    const prompt = buildDeduplicationPrompt(
      [{ text: 'Review budget', owner: 'Alice' }],
      [{ id: 'id-1', text: 'Prepare slides', owner: 'Bob' }],
    );
    expect(prompt).toContain('0: [owner: Alice] Review budget');
    expect(prompt).toContain('id-1: [owner: Bob] Prepare slides');
  });

  it('shows unassigned for null owners in existing items', () => {
    const prompt = buildDeduplicationPrompt(
      [{ text: 'Task A', owner: 'unassigned' }],
      [{ id: 'id-1', text: 'Task B', owner: null }],
    );
    expect(prompt).toContain('[owner: unassigned] Task A');
    expect(prompt).toContain('id-1: [owner: unassigned] Task B');
  });

  it('includes section headers', () => {
    const prompt = buildDeduplicationPrompt(
      [{ text: 'X', owner: 'A' }],
      [{ id: 'id-1', text: 'Y', owner: null }],
    );
    expect(prompt).toContain('## EXTRACTED (from new meeting)');
    expect(prompt).toContain('## EXISTING (already stored)');
  });

  it('limits existing items to 100', () => {
    const existing = Array.from({ length: 150 }, (_, i) => ({
      id: `id-${i}`,
      text: `Item ${i}`,
      owner: null,
    }));
    const prompt = buildDeduplicationPrompt([{ text: 'New', owner: 'A' }], existing);
    expect(prompt).toContain('id-99:');
    expect(prompt).not.toContain('id-100:');
  });
});

describe('deduplicateActionItems', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    fetchSpy.mockReset();
  });

  function mockFetchResponse(body: object) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(body) } }],
      }),
    });
  }

  it('short-circuits with empty extracted items', async () => {
    const result = await deduplicateActionItems(
      'key',
      [],
      [{ id: 'id-1', text: 'Existing', owner: null }],
    );
    expect(result).toEqual({ toCreate: [], toUpdate: [], toSkip: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('short-circuits with empty existing items — all to create', async () => {
    const result = await deduplicateActionItems(
      'key',
      [
        { text: 'Do X', owner: 'Alice' },
        { text: 'Do Y', owner: 'unassigned' },
      ],
      [],
    );
    expect(result.toCreate).toEqual([
      { text: 'Do X', owner: 'Alice' },
      { text: 'Do Y', owner: null },
    ]);
    expect(result.toUpdate).toEqual([]);
    expect(result.toSkip).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('parses a mixed create/skip/update response', async () => {
    mockFetchResponse({
      results: [
        {
          extractedIndex: 0,
          action: 'create',
          existingId: null,
          mergedText: null,
          mergedOwner: null,
        },
        {
          extractedIndex: 1,
          action: 'skip',
          existingId: 'id-1',
          mergedText: null,
          mergedOwner: null,
        },
        {
          extractedIndex: 2,
          action: 'update',
          existingId: 'id-2',
          mergedText: 'Improved task',
          mergedOwner: 'Bob',
        },
      ],
    });

    const result = await deduplicateActionItems(
      'key',
      [
        { text: 'Brand new task', owner: 'Alice' },
        { text: 'Review budget', owner: 'unassigned' },
        { text: 'Prepare slides with extra details', owner: 'Bob' },
      ],
      [
        { id: 'id-1', text: 'Review the budget', owner: null },
        { id: 'id-2', text: 'Prepare slides', owner: 'Bob' },
      ],
    );

    expect(result.toCreate).toEqual([{ text: 'Brand new task', owner: 'Alice' }]);
    expect(result.toSkip).toEqual(['Review budget']);
    expect(result.toUpdate).toEqual([{ existingId: 'id-2', text: 'Improved task', owner: 'Bob' }]);
  });

  it('defaults missing entries to create', async () => {
    mockFetchResponse({
      results: [
        {
          extractedIndex: 0,
          action: 'skip',
          existingId: 'id-1',
          mergedText: null,
          mergedOwner: null,
        },
      ],
    });

    const result = await deduplicateActionItems(
      'key',
      [
        { text: 'Matched', owner: 'A' },
        { text: 'Not in response', owner: 'B' },
      ],
      [{ id: 'id-1', text: 'Existing', owner: null }],
    );

    expect(result.toSkip).toEqual(['Matched']);
    expect(result.toCreate).toEqual([{ text: 'Not in response', owner: 'B' }]);
  });

  it('defaults entries with invalid extractedIndex to be ignored and items default to create', async () => {
    mockFetchResponse({
      results: [
        {
          extractedIndex: 99,
          action: 'skip',
          existingId: 'id-1',
          mergedText: null,
          mergedOwner: null,
        },
      ],
    });

    const result = await deduplicateActionItems(
      'key',
      [{ text: 'Only item', owner: 'A' }],
      [{ id: 'id-1', text: 'Existing', owner: null }],
    );

    expect(result.toCreate).toEqual([{ text: 'Only item', owner: 'A' }]);
  });

  it('defaults skip with unknown existingId to create', async () => {
    mockFetchResponse({
      results: [
        {
          extractedIndex: 0,
          action: 'skip',
          existingId: 'nonexistent',
          mergedText: null,
          mergedOwner: null,
        },
      ],
    });

    const result = await deduplicateActionItems(
      'key',
      [{ text: 'Item', owner: 'A' }],
      [{ id: 'id-1', text: 'Existing', owner: null }],
    );

    expect(result.toCreate).toEqual([{ text: 'Item', owner: 'A' }]);
    expect(result.toSkip).toEqual([]);
  });

  it('defaults update with missing mergedText to create', async () => {
    mockFetchResponse({
      results: [
        {
          extractedIndex: 0,
          action: 'update',
          existingId: 'id-1',
          mergedText: null,
          mergedOwner: null,
        },
      ],
    });

    const result = await deduplicateActionItems(
      'key',
      [{ text: 'Item', owner: 'A' }],
      [{ id: 'id-1', text: 'Existing', owner: null }],
    );

    expect(result.toCreate).toEqual([{ text: 'Item', owner: 'A' }]);
    expect(result.toUpdate).toEqual([]);
  });

  it('throws on API error', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(
      deduplicateActionItems(
        'key',
        [{ text: 'X', owner: 'A' }],
        [{ id: 'id-1', text: 'Y', owner: null }],
      ),
    ).rejects.toThrow('OpenAI API error (500)');
  });

  it('throws on empty response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    });

    await expect(
      deduplicateActionItems(
        'key',
        [{ text: 'X', owner: 'A' }],
        [{ id: 'id-1', text: 'Y', owner: null }],
      ),
    ).rejects.toThrow('Empty response from OpenAI');
  });
});
