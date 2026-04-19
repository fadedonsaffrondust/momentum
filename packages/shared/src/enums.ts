/**
 * Canonical enum tuples — the single source of truth for every string-set
 * shared between the Postgres column type (Drizzle `pgEnum`) and the API
 * contract (Zod `z.enum`). Define once here, import from both sides.
 *
 * Pure-constant module: zero runtime dependencies, safe to import from
 * `packages/db` without pulling in zod.
 *
 * `as const` is required so the inferred type is the narrow string-literal
 * tuple — both `pgEnum` and `z.enum` need that shape.
 *
 * Type aliases (e.g. `Priority`) live alongside their Zod schema in
 * `schemas.ts` — kept there so the type and the runtime parser are
 * defined together.
 */

export const PRIORITY = ['high', 'medium', 'low'] as const;
export const TASK_STATUS = ['todo', 'in_progress', 'done'] as const;
export const TASK_COLUMN = ['up_next', 'in_progress', 'done'] as const;
export const THEME = ['dark', 'light'] as const;
export const PARKING_STATUS = ['open', 'discussed', 'archived'] as const;
export const PARKING_VISIBILITY = ['team', 'private'] as const;
export const BRAND_STATUS = ['active', 'importing', 'import_failed'] as const;
export const BRAND_ACTION_STATUS = ['open', 'done'] as const;
export const MEETING_SOURCE = ['manual', 'recording_sync'] as const;
export const FEATURE_REQUEST_SYNC_STATUS = ['synced', 'pending', 'error'] as const;
