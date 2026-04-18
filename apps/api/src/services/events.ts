import type { Database } from '@momentum/db';
import { brandEvents, inboxEvents } from '@momentum/db';
import { db as defaultDb } from '../db.ts';

/**
 * Event-writer helpers for team-space.
 *
 * Two distinct surfaces:
 *   - `brand_events` — per-brand activity timeline, rendered on Overview.
 *   - `inbox_events` — per-recipient notifications, rendered on /inbox.
 *
 * Call sites `await` these for deterministic ordering, but helper failures
 * are logged and swallowed so they never break the main mutation. A missed
 * event is a UX glitch; a swallowed primary write is data loss.
 *
 * Suppression: `recordInboxEvent` is a no-op when `userId === actorId`
 * (you don't notify yourself of your own action). Enforced here, not at
 * call sites, so every route author gets it for free.
 */

export interface RecordBrandEventParams {
  brandId: string;
  actorId: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

export interface RecordInboxEventParams {
  userId: string; // recipient
  actorId: string; // initiator
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}

export async function recordBrandEvent(
  params: RecordBrandEventParams,
  database: Database = defaultDb,
): Promise<void> {
  try {
    await database.insert(brandEvents).values({
      brandId: params.brandId,
      actorId: params.actorId,
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      payload: params.payload ?? {},
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recordBrandEvent] failed', {
      brandId: params.brandId,
      eventType: params.eventType,
      err,
    });
  }
}

export async function recordInboxEvent(
  params: RecordInboxEventParams,
  database: Database = defaultDb,
): Promise<void> {
  // Self-suppression: never notify yourself of your own actions.
  if (params.userId === params.actorId) return;

  try {
    await database.insert(inboxEvents).values({
      userId: params.userId,
      actorId: params.actorId,
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload ?? {},
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recordInboxEvent] failed', {
      userId: params.userId,
      eventType: params.eventType,
      err,
    });
  }
}
