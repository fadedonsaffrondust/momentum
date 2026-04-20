import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCase, loadCases, type EvalCase } from './runner.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sample(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'test-001',
    input: 'hello?',
    as_user: 'nader',
    expected_tool_calls: ['getMyTasks'],
    answer_must_not_contain: ["I don't know"],
    ...overrides,
  };
}

describe('evaluateCase', () => {
  it('passes when all expected tool calls fired and forbidden phrases are absent', () => {
    const result = evaluateCase(sample(), {
      assistantText: "Here's what you have.",
      toolCalls: [{ name: 'getMyTasks' }],
    });
    expect(result.pass).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('fails when a required tool call is missing', () => {
    const result = evaluateCase(sample(), {
      assistantText: 'Sure.',
      toolCalls: [{ name: 'getTasks' }],
    });
    expect(result.pass).toBe(false);
    expect(result.reasons).toEqual(['missing expected tool call: getMyTasks']);
  });

  it('fails when a forbidden phrase appears in the answer (case-insensitive)', () => {
    const result = evaluateCase(sample(), {
      assistantText: "I don't know what you're asking.",
      toolCalls: [{ name: 'getMyTasks' }],
    });
    expect(result.pass).toBe(false);
    expect(result.reasons[0]).toMatch(/forbidden phrase/);
  });

  it('fails when a required phrase is missing', () => {
    const result = evaluateCase(
      sample({
        answer_must_contain: ['Boudin'],
      }),
      {
        assistantText: 'You have 1 task.',
        toolCalls: [{ name: 'getMyTasks' }],
      },
    );
    expect(result.pass).toBe(false);
    expect(result.reasons[0]).toMatch(/Boudin/);
  });

  it('out-of-scope (expected_tool_calls: []) fails when the LLM reaches for a tool', () => {
    const result = evaluateCase(sample({ id: 'oos-001', expected_tool_calls: [] }), {
      assistantText: 'Let me check.',
      toolCalls: [{ name: 'getBrand' }],
    });
    expect(result.pass).toBe(false);
    expect(result.reasons[0]).toMatch(/unexpected tool calls/);
  });

  it('out-of-scope passes when zero tool calls fire and no forbidden phrase is present', () => {
    const result = evaluateCase(sample({ id: 'oos-001', expected_tool_calls: [] }), {
      assistantText: 'I can only answer questions about Momentum data.',
      toolCalls: [],
    });
    expect(result.pass).toBe(true);
  });

  it('tolerates extra tool calls as long as the required ones are present', () => {
    const result = evaluateCase(sample(), {
      assistantText: 'OK.',
      toolCalls: [{ name: 'getMyTasks' }, { name: 'getBrand' }],
    });
    expect(result.pass).toBe(true);
  });
});

describe('loadCases', () => {
  it('loads the 20 shipped V1 starter cases, distributed per spec §10', () => {
    const cases = loadCases(path.resolve(__dirname, './cases.json'));
    expect(cases).toHaveLength(20);

    const count = (prefix: string) => cases.filter((c) => c.id.startsWith(prefix)).length;
    expect(count('tasks-')).toBe(8);
    expect(count('brands-')).toBe(4);
    expect(count('team-')).toBe(3);
    expect(count('analytical-')).toBe(3);
    expect(count('oos-')).toBe(2);
  });

  it('every case declares at least one forbidden phrase or tool expectation', () => {
    const cases = loadCases(path.resolve(__dirname, './cases.json'));
    for (const c of cases) {
      const hasToolExpectation = c.expected_tool_calls !== undefined;
      const hasPhraseExpectation =
        (c.answer_must_contain?.length ?? 0) > 0 || (c.answer_must_not_contain?.length ?? 0) > 0;
      expect(hasToolExpectation || hasPhraseExpectation).toBe(true);
    }
  });

  it('every case references a seeded user alias', () => {
    const cases = loadCases(path.resolve(__dirname, './cases.json'));
    const allowed = new Set(['nader', 'sara', 'ryan']);
    for (const c of cases) {
      expect(allowed.has(c.as_user)).toBe(true);
    }
  });
});
