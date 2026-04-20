import type { Database } from '@momentum/db';
import { bumpConversationUpdatedAt, getConversationForUser } from './conversations.ts';
import {
  insertMessage,
  listMessagesByConversation,
  type InsertMessageInput,
  type MessageRow,
} from './messages.ts';
import { insertToolCall, type InsertToolCallInput, type ToolCallRow } from './tool-calls.ts';

/**
 * The narrow persistence surface the orchestrator depends on. Kept tight
 * (four methods) so tests can stub it with an inline object and so future
 * providers — e.g. an eval-mode in-memory store — can swap in without
 * touching the Drizzle-backed implementation.
 *
 * Conversation CRUD (create, list, archive) lives in `./conversations.ts`
 * and is consumed by the Fastify routes (Task 6), not here.
 */
export interface JarvisPersistence {
  listMessagesByConversation(conversationId: string, limit?: number): Promise<MessageRow[]>;
  insertMessage(input: InsertMessageInput): Promise<MessageRow>;
  insertToolCall(input: InsertToolCallInput): Promise<ToolCallRow>;
  bumpConversationUpdatedAt(conversationId: string): Promise<void>;
  getConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<{ id: string; userId: string } | null>;
}

/**
 * The default Drizzle-backed adapter. One is constructed per Fastify
 * request scope (Task 6) and passed into JarvisService.
 */
export function buildPersistence(db: Database): JarvisPersistence {
  return {
    listMessagesByConversation: (conversationId, limit) =>
      listMessagesByConversation(db, conversationId, { limit }),
    insertMessage: (input) => insertMessage(db, input),
    insertToolCall: (input) => insertToolCall(db, input),
    bumpConversationUpdatedAt: (conversationId) => bumpConversationUpdatedAt(db, conversationId),
    getConversationForUser: (conversationId, userId) =>
      getConversationForUser(db, conversationId, userId),
  };
}

export * from './conversations.ts';
export * from './messages.ts';
export * from './tool-calls.ts';
