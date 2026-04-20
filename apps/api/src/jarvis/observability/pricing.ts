import type { LLMUsage } from '../llm-provider.ts';

/**
 * Anthropic pricing per model, stored as USD-per-token. Source: the
 * public pricing page at Anthropic's launch of each model; update here
 * when the price changes. The numbers are load-bearing for the cost
 * telemetry in every turn log, so staleness matters — a stale rate
 * silently under/over-reports every Jarvis turn in the monitoring
 * surface Nader watches to catch runaway spend.
 *
 * Cache-creation is the 5-minute ephemeral write rate (1.25× input);
 * cache-read is the 10× discount we earn on every subsequent turn
 * within the cache window.
 */
export interface ModelPricing {
  inputPerToken: number;
  outputPerToken: number;
  cacheReadPerToken: number;
  cacheCreationPerToken: number;
}

const PER_MILLION = 1 / 1_000_000;

export const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = Object.freeze({
  // Claude Sonnet 4.6 — V1 default.
  'claude-sonnet-4-6': {
    inputPerToken: 3 * PER_MILLION,
    outputPerToken: 15 * PER_MILLION,
    cacheReadPerToken: 0.3 * PER_MILLION,
    cacheCreationPerToken: 3.75 * PER_MILLION,
  },
  // Claude Opus 4.7 — available if someone overrides the model env.
  'claude-opus-4-7': {
    inputPerToken: 15 * PER_MILLION,
    outputPerToken: 75 * PER_MILLION,
    cacheReadPerToken: 1.5 * PER_MILLION,
    cacheCreationPerToken: 18.75 * PER_MILLION,
  },
  // Claude Haiku 4.5 — candidate for the router-on-Haiku optimization
  // captured in docs/JARVIS-TODOS.md.
  'claude-haiku-4-5': {
    inputPerToken: 0.8 * PER_MILLION,
    outputPerToken: 4 * PER_MILLION,
    cacheReadPerToken: 0.08 * PER_MILLION,
    cacheCreationPerToken: 1 * PER_MILLION,
  },
});

/** Model used when the reported id is not in the pricing table. */
export const FALLBACK_MODEL_ID = 'claude-sonnet-4-6';

export interface CostEstimate {
  costUsd: number;
  /** True when the exact model id was priced; false when we fell back. */
  pricingResolved: boolean;
  /** The pricing entry actually used to compute the cost. */
  resolvedModelId: string;
}

/**
 * Estimate the turn's cost from reported token usage. Matches the model
 * id exactly first, then by prefix (for date-suffixed aliases like
 * `claude-sonnet-4-6-20251001`), then falls back to Sonnet. The return
 * shape carries `pricingResolved: false` on fallback so callers can
 * surface "priced with fallback rate" in logs.
 */
export function estimateCostUsd(model: string, usage: LLMUsage): CostEstimate {
  const exact = MODEL_PRICING[model];
  if (exact) return computeCost(model, exact, usage, true);

  const prefix = Object.entries(MODEL_PRICING).find(([id]) => model.startsWith(id));
  if (prefix) return computeCost(prefix[0], prefix[1], usage, true);

  const fallback = MODEL_PRICING[FALLBACK_MODEL_ID]!;
  return computeCost(FALLBACK_MODEL_ID, fallback, usage, false);
}

function computeCost(
  resolvedModelId: string,
  pricing: ModelPricing,
  usage: LLMUsage,
  pricingResolved: boolean,
): CostEstimate {
  const cost =
    usage.inputTokens * pricing.inputPerToken +
    usage.outputTokens * pricing.outputPerToken +
    usage.cacheReadInputTokens * pricing.cacheReadPerToken +
    usage.cacheCreationInputTokens * pricing.cacheCreationPerToken;
  return {
    costUsd: roundUsd(cost),
    pricingResolved,
    resolvedModelId,
  };
}

/** Round to 6 decimal places — sub-penny precision without IEEE noise. */
function roundUsd(usd: number): number {
  return Math.round(usd * 1_000_000) / 1_000_000;
}
