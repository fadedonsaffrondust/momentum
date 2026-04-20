import { describe, it, expect } from 'vitest';
import type { LLMUsage } from '../llm-provider.ts';
import { estimateCostUsd, FALLBACK_MODEL_ID, MODEL_PRICING } from './pricing.ts';

const SONNET_USAGE: LLMUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cacheReadInputTokens: 1_000_000,
  cacheCreationInputTokens: 1_000_000,
};

describe('estimateCostUsd', () => {
  it('prices Sonnet usage at the published per-million rates', () => {
    const { costUsd, pricingResolved, resolvedModelId } = estimateCostUsd(
      'claude-sonnet-4-6',
      SONNET_USAGE,
    );
    // 3 (input) + 15 (output) + 0.30 (cache read) + 3.75 (cache create) = $22.05
    expect(costUsd).toBeCloseTo(22.05, 4);
    expect(pricingResolved).toBe(true);
    expect(resolvedModelId).toBe('claude-sonnet-4-6');
  });

  it('returns zero for empty usage', () => {
    const { costUsd } = estimateCostUsd('claude-sonnet-4-6', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    expect(costUsd).toBe(0);
  });

  it('resolves date-suffixed model ids via prefix match', () => {
    const { pricingResolved, resolvedModelId } = estimateCostUsd(
      'claude-sonnet-4-6-20251001',
      SONNET_USAGE,
    );
    expect(pricingResolved).toBe(true);
    expect(resolvedModelId).toBe('claude-sonnet-4-6');
  });

  it('falls back to Sonnet rates for unknown models, flagging pricingResolved=false', () => {
    const { pricingResolved, resolvedModelId } = estimateCostUsd('gpt-5-not-real', SONNET_USAGE);
    expect(pricingResolved).toBe(false);
    expect(resolvedModelId).toBe(FALLBACK_MODEL_ID);
  });

  it('Opus is priced 5× Sonnet input and 5× output', () => {
    const sonnet = estimateCostUsd('claude-sonnet-4-6', {
      inputTokens: 1000,
      outputTokens: 1000,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    const opus = estimateCostUsd('claude-opus-4-7', {
      inputTokens: 1000,
      outputTokens: 1000,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    expect(opus.costUsd / sonnet.costUsd).toBeCloseTo(5, 3);
  });

  it('cache-read is 10× cheaper than regular input for every priced model', () => {
    for (const [id, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing.cacheReadPerToken * 10).toBeCloseTo(pricing.inputPerToken, 10);
      // Silence unused-var warning in strict mode
      void id;
    }
  });
});
