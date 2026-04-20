import { describe, it, expect } from 'vitest';
import {
  assertStaticPromptUnderCap,
  buildSynthesisSystemBlocks,
  SYNTHESIS_PROMPT_V1_STATIC,
  SYSTEM_PROMPT_TOKEN_CAP,
} from './synthesis.ts';

const SAMPLE_INPUT = {
  user: { id: 'u1', displayName: 'Nader' },
  now: new Date('2026-04-19T12:00:00.000Z'),
  teamRoster: [
    { id: 'u1', displayName: 'Nader', email: 'nader@omnirev.ai' },
    { id: 'u2', displayName: 'Sara', email: 'sara@omnirev.ai' },
  ],
  brandPortfolio: [
    { id: 'b1', name: 'Boudin', status: 'active', goals: 'Grow catering 20% QoQ' },
    { id: 'b2', name: 'Chipotle', status: 'active', goals: null },
  ],
  omnirevContext: '## What Omnirev Does\n\nAI-powered catering sales automation.',
};

describe('buildSynthesisSystemBlocks', () => {
  it('returns exactly two blocks: static (cached) + dynamic (not cached)', () => {
    const blocks = buildSynthesisSystemBlocks(SAMPLE_INPUT);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[1]!.cache_control).toBeUndefined();
  });

  it('static block contains role, behavior rules, and the Omnirev context', () => {
    const blocks = buildSynthesisSystemBlocks(SAMPLE_INPUT);
    const staticText = blocks[0]!.text;
    expect(staticText).toMatch(/You are Jarvis/);
    expect(staticText).toMatch(/Behavior rules:/);
    expect(staticText).toMatch(/AI-powered catering sales automation/);
  });

  it('dynamic block carries identity, today, roster, and portfolio', () => {
    const blocks = buildSynthesisSystemBlocks(SAMPLE_INPUT);
    const dynamicText = blocks[1]!.text;
    expect(dynamicText).toMatch(/Current user: Nader \(u1\)/);
    expect(dynamicText).toMatch(/Current date: 2026-04-19/);
    expect(dynamicText).toMatch(/- Nader \(u1\) — nader@omnirev\.ai/);
    expect(dynamicText).toMatch(/- Boudin \(b1\) — active, goals: Grow catering/);
    expect(dynamicText).toMatch(/- Chipotle \(b2\) — active$/m); // no goals trailer
  });

  it('renders placeholders when roster / portfolio are empty', () => {
    const blocks = buildSynthesisSystemBlocks({
      ...SAMPLE_INPUT,
      teamRoster: [],
      brandPortfolio: [],
    });
    expect(blocks[1]!.text).toMatch(/\(no active team members\)/);
    expect(blocks[1]!.text).toMatch(/\(no brands yet\)/);
  });

  it('truncates long brand goals at 80 chars with an ellipsis', () => {
    const longGoal = 'a'.repeat(200);
    const blocks = buildSynthesisSystemBlocks({
      ...SAMPLE_INPUT,
      brandPortfolio: [{ id: 'b1', name: 'X', status: 'active', goals: longGoal }],
    });
    expect(blocks[1]!.text).toMatch(/goals: a{80}…/);
  });
});

describe('assertStaticPromptUnderCap', () => {
  it('passes for the shipped V1 static prompt', () => {
    expect(() => assertStaticPromptUnderCap(SYNTHESIS_PROMPT_V1_STATIC)).not.toThrow();
  });

  it('throws when content exceeds the cap, pointing at the guardrail', () => {
    // ~12KB ≈ 3000 tokens > 2000 cap
    const fat = 'x'.repeat(12_000);
    expect(() => assertStaticPromptUnderCap(fat)).toThrow(/above the 2000-token cap/);
  });

  it('cap is 2000 per spec §5 + guardrails', () => {
    expect(SYSTEM_PROMPT_TOKEN_CAP).toBe(2000);
  });
});
