import { desc, eq } from 'drizzle-orm';
import type { Database } from '@momentum/db';
import { jarvisToolCalls } from '@momentum/db';

/**
 * Denormalized record of every tool invocation. The orchestrator writes
 * one row per tool call alongside the assistant message that issued it.
 * Tool calls are technically recoverable from `jarvis_messages.content`
 * (tool_use blocks), but having them as a flat queryable table makes
 * "which tools fail most" and "which are slow" trivial — see spec §3.
 */
export interface ToolCallRow {
  id: string;
  messageId: string;
  toolName: string;
  arguments: unknown;
  result: unknown;
  error: string | null;
  latencyMs: number;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

function normalize(row: typeof jarvisToolCalls.$inferSelect): ToolCallRow {
  return {
    id: row.id,
    messageId: row.messageId,
    toolName: row.toolName,
    arguments: row.arguments,
    result: row.result,
    error: row.error,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
}

export interface InsertToolCallInput {
  messageId: string;
  toolName: string;
  arguments: unknown;
  /** Null on error — mirrors the `error` field. */
  result?: unknown;
  error?: string | null;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export async function insertToolCall(
  db: Database,
  input: InsertToolCallInput,
): Promise<ToolCallRow> {
  const [row] = await db
    .insert(jarvisToolCalls)
    .values({
      messageId: input.messageId,
      toolName: input.toolName,
      arguments: input.arguments,
      result: input.result ?? null,
      error: input.error ?? null,
      latencyMs: input.latencyMs,
      metadata: input.metadata ?? {},
    })
    .returning();
  if (!row) throw new Error('insertToolCall: insert returned no row');
  return normalize(row);
}

/** Newest-first for analytics surfaces (Task 10 observability). */
export async function listToolCallsByMessage(
  db: Database,
  messageId: string,
): Promise<ToolCallRow[]> {
  const rows = await db
    .select()
    .from(jarvisToolCalls)
    .where(eq(jarvisToolCalls.messageId, messageId))
    .orderBy(desc(jarvisToolCalls.createdAt));
  return rows.map(normalize);
}
