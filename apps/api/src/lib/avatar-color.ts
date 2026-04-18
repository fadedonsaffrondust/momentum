import { ROLE_COLOR_PALETTE } from '@momentum/shared';

/**
 * Deterministic email → palette-index hash. djb2 variant — stable across
 * server restarts and across re-registrations of the same email, so a user
 * re-created with the same email gets the same avatar color.
 *
 * Not cross-language: the SQL backfill in 0006_team_space.sql uses Postgres'
 * hashtext() for pre-existing users, which will produce a different index.
 * That's fine — existing users keep whatever color the SQL chose; this
 * function only runs on fresh signups (§6.1 of the team-space spec).
 */
export function avatarColorForEmail(email: string): string {
  const normalized = email.toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % ROLE_COLOR_PALETTE.length;
  return ROLE_COLOR_PALETTE[index]!;
}
