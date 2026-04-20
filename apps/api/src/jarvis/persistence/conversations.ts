import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '@momentum/db';
import { jarvisConversations } from '@momentum/db';

export interface ConversationRow {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  metadata: Record<string, unknown>;
}

function normalize(row: typeof jarvisConversations.$inferSelect): ConversationRow {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
}

export interface CreateConversationInput {
  userId: string;
  title: string;
  metadata?: Record<string, unknown>;
}

export async function createConversation(
  db: Database,
  input: CreateConversationInput,
): Promise<ConversationRow> {
  const [row] = await db
    .insert(jarvisConversations)
    .values({
      userId: input.userId,
      title: input.title,
      metadata: input.metadata ?? {},
    })
    .returning();
  if (!row) throw new Error('createConversation: insert returned no row');
  return normalize(row);
}

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  /** Include soft-archived conversations in results. Default false. */
  includeArchived?: boolean;
}

export async function listConversationsByUser(
  db: Database,
  userId: string,
  opts: ListConversationsOptions = {},
): Promise<ConversationRow[]> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const includeArchived = opts.includeArchived ?? false;

  const condition = includeArchived
    ? eq(jarvisConversations.userId, userId)
    : and(eq(jarvisConversations.userId, userId), isNull(jarvisConversations.archivedAt));

  const rows = await db
    .select()
    .from(jarvisConversations)
    .where(condition)
    .orderBy(desc(jarvisConversations.updatedAt))
    .limit(limit)
    .offset(offset);

  return rows.map(normalize);
}

/**
 * Fetch a conversation only if the caller owns it. Callers MUST use this
 * instead of a raw lookup — returning null on ownership mismatch is how
 * routes implement the "404 on cross-user access" invariant from the
 * guardrails ("Conversations are private to their owner").
 */
export async function getConversationForUser(
  db: Database,
  conversationId: string,
  userId: string,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(jarvisConversations)
    .where(and(eq(jarvisConversations.id, conversationId), eq(jarvisConversations.userId, userId)))
    .limit(1);
  const row = rows[0];
  return row ? normalize(row) : null;
}

/**
 * Soft-archive a conversation. Hard delete is deferred to V1.5 per the
 * guardrails ("Soft delete only"). Callers must check ownership before
 * invoking — this helper takes a naked id so it can be reused from
 * admin/maintenance contexts later.
 */
export async function archiveConversation(db: Database, conversationId: string): Promise<void> {
  await db
    .update(jarvisConversations)
    .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(jarvisConversations.id, conversationId));
}

/** Bumped at the end of every turn so conversation lists sort recent-first. */
export async function bumpConversationUpdatedAt(
  db: Database,
  conversationId: string,
): Promise<void> {
  await db
    .update(jarvisConversations)
    .set({ updatedAt: sql`now()` })
    .where(eq(jarvisConversations.id, conversationId));
}

/** Overwrite the conversation's display title. No-op if the row does not exist. */
export async function updateConversationTitle(
  db: Database,
  conversationId: string,
  title: string,
): Promise<void> {
  await db
    .update(jarvisConversations)
    .set({ title })
    .where(eq(jarvisConversations.id, conversationId));
}
