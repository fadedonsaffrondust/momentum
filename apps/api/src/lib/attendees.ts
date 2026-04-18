import { isNull } from 'drizzle-orm';
import type { Database } from '@momentum/db';
import { users } from '@momentum/db';
import { db as defaultDb } from '../db.ts';

/**
 * Email detection that's strict enough to avoid false positives on names
 * like "alice.wonderland" but lenient enough for normal addresses.
 */
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserEmail {
  id: string;
  email: string;
}

/**
 * Pure: given a list of attendee strings (names or emails) and the team
 * roster, return the deduped uuids of team users whose emails appear in
 * the attendee list. Non-email entries (plain names) and unknown emails
 * are dropped. Comparison is case-insensitive on both sides.
 *
 * Exported for unit testing and re-use by the tldv sync path.
 */
export function matchAttendeeUserIds(
  attendees: readonly string[],
  teamUsers: readonly UserEmail[],
): string[] {
  const emailToId = new Map<string, string>();
  for (const u of teamUsers) {
    emailToId.set(u.email.toLowerCase(), u.id);
  }

  const matched: string[] = [];
  const seen = new Set<string>();
  for (const entry of attendees) {
    const trimmed = entry.trim();
    if (!EMAIL_LIKE.test(trimmed)) continue;
    const id = emailToId.get(trimmed.toLowerCase());
    if (id && !seen.has(id)) {
      matched.push(id);
      seen.add(id);
    }
  }
  return matched;
}

/**
 * DB-aware wrapper: loads the active team roster and matches attendees
 * against it. Deactivated users are excluded — a deactivated user whose
 * email happens to match an attendee shouldn't pull them back into the
 * meeting record.
 */
export async function resolveAttendeeUserIds(
  attendees: readonly string[],
  database: Database = defaultDb,
): Promise<string[]> {
  if (attendees.length === 0) return [];
  const rows = await database
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(isNull(users.deactivatedAt));
  return matchAttendeeUserIds(attendees, rows);
}
