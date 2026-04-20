import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '@momentum/db';
import { jarvisMessages } from '@momentum/db';
import type { LLMUsage } from '../llm-provider.ts';

/**
 * A persisted message. `content` is stored as Anthropic-format content
 * blocks (text, tool_use, tool_result) so the full assistant turn is
 * replayable on the next call (see spec §3).
 *
 * `role: 'tool'` is Momentum's own convention for Anthropic `role: 'user'`
 * messages that carry tool_result blocks. Mapped back to `'user'` at
 * Anthropic-call time in the orchestrator.
 */
export interface MessageRow {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  /** Anthropic content block array. */
  content: unknown;
  intent: string | null;
  model: string | null;
  latencyMs: number | null;
  tokenUsage: LLMUsage | null;
  error: Record<string, unknown> | null;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

function normalize(row: typeof jarvisMessages.$inferSelect): MessageRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    intent: row.intent,
    model: row.model,
    latencyMs: row.latencyMs,
    tokenUsage: (row.tokenUsage as LLMUsage | null) ?? null,
    error: (row.error as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
}

export interface InsertMessageInput {
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: unknown;
  intent?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  tokenUsage?: LLMUsage | null;
  error?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export async function insertMessage(db: Database, input: InsertMessageInput): Promise<MessageRow> {
  const [row] = await db
    .insert(jarvisMessages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      intent: input.intent ?? null,
      model: input.model ?? null,
      latencyMs: input.latencyMs ?? null,
      tokenUsage: input.tokenUsage ?? null,
      error: input.error ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();
  if (!row) throw new Error('insertMessage: insert returned no row');
  return normalize(row);
}

export interface ListMessagesOptions {
  /**
   * How many messages to return. Default 20 per the spec's context-window
   * budget. Rows come back in chronological (oldest → newest) order so
   * the orchestrator can feed them straight to Anthropic.
   */
  limit?: number;
}

/**
 * Load the most recent N messages for a conversation, returned in
 * chronological order. We query DESC + reverse rather than ASC + LIMIT so
 * the user always sees the latest activity — with thousands of messages
 * an ASC limit would truncate the recent turns and feed the model only
 * ancient history.
 */
export async function listMessagesByConversation(
  db: Database,
  conversationId: string,
  opts: ListMessagesOptions = {},
): Promise<MessageRow[]> {
  const limit = opts.limit ?? 20;
  const rows = await db
    .select()
    .from(jarvisMessages)
    .where(eq(jarvisMessages.conversationId, conversationId))
    .orderBy(desc(jarvisMessages.createdAt))
    .limit(limit);
  return rows.map(normalize).reverse();
}

/**
 * All messages for a conversation in chronological order, unbounded. Used
 * by `GET /api/jarvis/conversations/:id` (Task 6) which returns the full
 * thread for rendering. Not used by the orchestrator — that path always
 * bounds the history.
 */
export async function listAllMessagesByConversation(
  db: Database,
  conversationId: string,
): Promise<MessageRow[]> {
  const rows = await db
    .select()
    .from(jarvisMessages)
    .where(eq(jarvisMessages.conversationId, conversationId))
    .orderBy(asc(jarvisMessages.createdAt));
  return rows.map(normalize);
}

/**
 * Extract the plain text of the oldest user-role message for a
 * conversation, or null if none exists yet. Used by the auto-title
 * logic so a conversation that was created with the placeholder title
 * back-fills from its actual first question instead of whatever turn
 * triggered the self-heal. Concatenates every text block so a user
 * message split across blocks still round-trips correctly.
 */
export async function findFirstUserMessageText(
  db: Database,
  conversationId: string,
): Promise<string | null> {
  const rows = await db
    .select()
    .from(jarvisMessages)
    .where(and(eq(jarvisMessages.conversationId, conversationId), eq(jarvisMessages.role, 'user')))
    .orderBy(asc(jarvisMessages.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const blocks = row.content as unknown;
  if (!Array.isArray(blocks)) return null;
  const text = blocks
    .filter(
      (b): b is { type: 'text'; text: string } =>
        typeof b === 'object' &&
        b !== null &&
        (b as { type?: unknown }).type === 'text' &&
        typeof (b as { text?: unknown }).text === 'string',
    )
    .map((b) => b.text)
    .join('\n')
    .trim();
  return text.length > 0 ? text : null;
}
