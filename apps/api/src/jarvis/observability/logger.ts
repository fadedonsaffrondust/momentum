import type { LLMUsage } from '../llm-provider.ts';
import type { JarvisLogger } from '../tools/types.ts';
import type { ToolCallRecord } from '../orchestrator.ts';
import { estimateCostUsd } from './pricing.ts';

/**
 * Structured per-turn log shape per spec §9. Emitted once at the end of
 * every turn (success, error, or timeout) on the Fastify app logger so
 * ops sees exactly one pino JSON record per Jarvis turn. The shape is
 * stable contract — downstream grep/dashboards depend on it.
 */
export interface JarvisTurnLog {
  conversationId: string;
  userId: string;
  intent: string | null;
  toolCalls: Array<{ name: string; latencyMs: number; success: boolean }>;
  totalLatencyMs: number;
  tokenUsage: LLMUsage;
  costEstimateUsd: number;
  model: string;
  status: 'success' | 'error' | 'timeout';
  /** Error summary (`name: message`), present only when status !== 'success'. */
  error?: string;
}

export interface LogJarvisTurnInput {
  conversationId: string;
  userId: string;
  /** Router-classified intent. Always null in V1 (deferred); reserved shape. */
  intent: string | null;
  toolCalls: ToolCallRecord[];
  totalLatencyMs: number;
  tokenUsage: LLMUsage;
  /** Model reported by the LLM response; empty string when unknown (pre-turn failure). */
  model: string;
  status: 'success' | 'error' | 'timeout';
  /** Raw error object; serialized to `name: message` for the log. */
  error?: unknown;
}

export function logJarvisTurn(logger: JarvisLogger, input: LogJarvisTurnInput): JarvisTurnLog {
  const { costUsd } = estimateCostUsd(input.model || 'unknown', input.tokenUsage);
  const errorMessage = serializeError(input.error);

  const log: JarvisTurnLog = {
    conversationId: input.conversationId,
    userId: input.userId,
    intent: input.intent,
    toolCalls: input.toolCalls.map((tc) => ({
      name: tc.name,
      latencyMs: tc.latencyMs,
      success: tc.error === null,
    })),
    totalLatencyMs: input.totalLatencyMs,
    tokenUsage: input.tokenUsage,
    costEstimateUsd: costUsd,
    model: input.model || 'unknown',
    status: input.status,
    ...(errorMessage ? { error: errorMessage } : {}),
  };

  if (input.status === 'success') {
    logger.info(log, 'jarvis turn completed');
  } else {
    logger.error(log, 'jarvis turn failed');
  }
  return log;
}

function serializeError(err: unknown): string | undefined {
  if (err == null) return undefined;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
