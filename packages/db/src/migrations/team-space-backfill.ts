/**
 * Team Space V1 post-migration backfill.
 *
 * The SQL migration 0006_team_space.sql handles column-level backfills
 * (display_name, avatar_color, parking visibility). Attendee linking was
 * left out because it's cleaner in TS, and it's the only per-row operation
 * that benefits from application-level string handling (email normalization).
 *
 * This script email-matches existing brand_meetings.attendees[] entries
 * against users.email (case-insensitive) and populates
 * brand_meetings.attendee_user_ids[] with the matched user ids.
 *
 * Idempotent — safe to re-run. New users that sign up after this runs will
 * be reflected on next invocation. Routine operation: invoked once after
 * `pnpm db:migrate`, and ad-hoc when new users join if pre-existing meetings
 * should retroactively show their avatars.
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import { users, brandMeetings } from '../schema.ts';

export interface BackfillResult {
  meetingsScanned: number;
  meetingsUpdated: number;
  usersMatched: number;
}

export interface UserIndex {
  id: string;
  email: string;
}

/**
 * Resolve a list of raw attendee emails to team user ids.
 * Case-insensitive match. Duplicates collapsed. Non-team attendees ignored.
 * Pure; exported for unit testing.
 */
export function matchAttendeesToUsers(attendees: string[], users: UserIndex[]): string[] {
  const emailToId = new Map<string, string>();
  for (const u of users) {
    emailToId.set(u.email.toLowerCase(), u.id);
  }
  const matched: string[] = [];
  for (const email of attendees) {
    const id = emailToId.get(email.toLowerCase());
    if (id && !matched.includes(id)) matched.push(id);
  }
  return matched;
}

/**
 * Returns true if the two id arrays represent the same set (order-independent).
 * Pure; exported for unit testing.
 */
export function isSameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export async function backfillAttendeeUserIds(
  db: PostgresJsDatabase<Record<string, unknown>>,
): Promise<BackfillResult> {
  const allUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);

  const meetings = await db
    .select({
      id: brandMeetings.id,
      attendees: brandMeetings.attendees,
      attendeeUserIds: brandMeetings.attendeeUserIds,
    })
    .from(brandMeetings);

  let updated = 0;
  let matched = 0;

  for (const m of meetings) {
    const matchedIds = matchAttendeesToUsers(m.attendees, allUsers);
    if (isSameIdSet(m.attendeeUserIds, matchedIds)) continue;

    await db
      .update(brandMeetings)
      .set({ attendeeUserIds: matchedIds })
      .where(eq(brandMeetings.id, m.id));

    updated += 1;
    matched += matchedIds.length;
  }

  return {
    meetingsScanned: meetings.length,
    meetingsUpdated: updated,
    usersMatched: matched,
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set — copy .env.example to .env first.');
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('[team-space-backfill] matching meeting attendees to users…');
  const result = await backfillAttendeeUserIds(db);
  console.log(
    `[team-space-backfill] scanned ${result.meetingsScanned} meetings, ` +
      `updated ${result.meetingsUpdated}, matched ${result.usersMatched} attendees`,
  );

  await client.end();
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[team-space-backfill] failed:', err);
    process.exit(1);
  });
}

// Avoid the "empty import" warning on index re-exports.
export const _sql = sql;
