import { asc, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '@momentum/db';
import { brands, users } from '@momentum/db';
import type { SynthesisBrand, SynthesisTeamMember, SynthesisUser } from './synthesis.ts';

/**
 * Roster loaders called once per turn by the orchestrator (not once per
 * tool call, and not cached — see the guardrail "Let's add a short cache
 * for the team/brand rosters since we load them every turn" which
 * explicitly refuses it). A stale roster causes trust-destroying bugs,
 * so correctness wins over the tiny latency tax of two fast queries.
 */

export async function loadTeamRoster(db: Database): Promise<SynthesisTeamMember[]> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
    })
    .from(users)
    .where(isNull(users.deactivatedAt))
    .orderBy(asc(users.displayName));
  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName || r.email,
    email: r.email,
  }));
}

export async function loadBrandPortfolio(db: Database): Promise<SynthesisBrand[]> {
  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      status: brands.status,
      goals: brands.goals,
    })
    .from(brands)
    .orderBy(desc(brands.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    goals: r.goals,
  }));
}

/**
 * Look up the acting user's profile for the Identity section. We store
 * only `userId` on the JWT (guardrail "Permission model in V1") so the
 * display name comes from a cheap query.
 */
export async function loadActingUser(db: Database, userId: string): Promise<SynthesisUser> {
  const rows = await db
    .select({ id: users.id, displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const found = rows[0];
  if (!found) {
    // Deactivated or missing account — we still need to render the
    // identity block. Fall back to the id as the display name.
    return { id: userId, displayName: userId };
  }
  return { id: found.id, displayName: found.displayName || found.email };
}
