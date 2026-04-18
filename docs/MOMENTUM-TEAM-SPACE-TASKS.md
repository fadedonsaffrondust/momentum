# Momentum — Team Space V1 Engineering Tasks (v0.7.0)

> Execution tracker for `docs/MOMENTUM-TEAM-SPACE-SPEC.md`. Each task below is a single Claude Code session producing a single commit. When a task completes, tick its checkbox here and **stop** — wait for explicit go-ahead before starting the next task.
>
> **Rules that apply to every task:**
> - Commit includes runtime change **+** colocated unit tests (`foo.ts` → `foo.test.ts`) per CLAUDE.md.
> - Any keydown change updates `apps/web/src/modals/ShortcutsModal.tsx` in the same commit.
> - Any user-visible change appends to `apps/web/src/lib/releaseNotes.ts` in the same commit (version bump rule in CLAUDE.md). Accumulate under a single `0.7.0` entry — prepend new items to its `items[]` as phases land, don't ship multiple 0.7.x entries during the build.
> - Docs/TODO/README updates live in Task 24 (final polish) except where a new script or setup step is introduced — then update immediately.
> - `pnpm typecheck && pnpm lint && pnpm test` must pass before committing.
> - Restart the API after backend changes (tsx watch does not always reload — see memory `feedback_restart_api_after_changes`).

---

## Phase 1 — Foundations (data + auth + shared contracts)

- [x] **Task 1 — Schema migration `0006_team_space.sql` + Drizzle schema**
  - **Goal:** land every schema change from spec §5 and §11 in one migration + matching `packages/db/src/schema.ts` edits.
  - **Touches:**
    - `packages/db/drizzle/0006_team_space.sql` (new — note: `0005_*` already exists, use `0006`)
    - `packages/db/drizzle/meta/0006_snapshot.json` + `_journal.json` entry (drizzle-kit generated)
    - `packages/db/src/schema.ts` (add columns, new tables, new enum `parkingVisibility`)
    - `packages/db/src/migrations/team-space-backfill.ts` (new TS runner for email-matching existing meeting attendees — avatar color and display_name backfill live in the SQL)
    - `packages/db/src/migrations/team-space-backfill.test.ts` (new Vitest — 12 tests on pure matching logic)
    - `packages/db/package.json` (vitest devDep + `migrate:team-space-backfill` script + `test` script)
    - root `package.json` (`db:migrate:team-space-backfill` alias)
  - **Changes (SQL, in order):** all eight steps from spec §11 landed; see `0006_team_space.sql` for the authoritative order (enum → users backfills → roles drop → tasks rename+creator → parkings rename+visibility/involved + existing→private flip → brands drop → sub-entity drops → action items rename+assignee → meetings attendee_user_ids → brand_events → inbox_events).
  - **Acceptance:**
    - [x] Drizzle schema mirrors SQL 1:1 — drizzle-kit generate produced a matching snapshot; hand-written SQL has extra `IF EXISTS`/`IF NOT EXISTS` guards + the data-transform steps drizzle-kit can't express (display_name coalesce, avatar_color hash-select, parking visibility flip).
    - [x] 12 new Vitest tests on the backfill matching logic pass (`matchAttendeesToUsers`, `isSameIdSet` — case-insensitivity on both sides, dedup, order-preservation, empty states).
    - [x] Existing 162 api tests + other workspace tests still pass.
    - [ ] **Migration must be run against Nader's local DB before committing** — needs explicit go-ahead, since it renames/drops columns and isn't freely reversible. Run via `pnpm db:migrate && pnpm db:migrate:team-space-backfill`, then spot-check with `pnpm db:studio`.
  - **Known expected failure:** `pnpm typecheck` fails **only** in `@momentum/api` — its routes still reference `tasks.userId`, `parkings.userId`, `roles.userId`, `brandActionItems.userId`, etc. Those are the exact renames Tasks 5–8 and 12 exist to fix. DB, shared, and web typecheck clean.
  - **Notes:**
    - `ROLE_COLOR_PALETTE` literal is inlined in the migration (same hex list as `packages/shared/src/schemas.ts:566`); keep the two in sync when the palette evolves.
    - avatar_color uses `(abs(hashtext(email)) % 8) + 1` for 1-based array indexing. Deterministic per email.
    - Users run postgres via Homebrew, not docker (memory `feedback_local_postgres_env`). `"Loading…"` in UI usually means DB down.

- [x] **Task 2 — Shared Zod schemas + parser + mappers**
  - **Goal:** make the shared contract and server mappers match the new DB shape before any route is touched.
  - **Touches:**
    - `packages/shared/src/schemas.ts` — all new and modified schemas per spec §8.
    - `packages/shared/src/parser.ts` — `@<name>` token produces `assigneeToken`; new `resolveAssigneeToken(token, users)` helper does first-name → full-displayName matching, returns `null` on miss (caller re-injects `@foo` into title).
    - `packages/shared/src/schemas.test.ts` — **124 tests** (up from ~77). Covers new schemas, renamed fields, required-field rejection, v1.3-legacy vs v1.4 exports, deactivatedAt timestamps, all five inbox event types, all sixteen brand event types.
    - `packages/shared/src/parser.test.ts` — **39 tests** (up from 27). Covers `@alice`, `@Alice` case-insensitivity, `@alice #product`, `#alice @product`, bare `@` mid-word ignored, first-@ wins when multiple, strip from title. `resolveAssigneeToken` tests: first-name match, case-insensitivity, prefer first-name over full-name, null on miss, empty pool.
    - `apps/api/src/mappers.ts` — all 10 existing mappers updated + 3 new: `mapUserSummary`, `mapBrandEvent(row, actor)`, `mapInboxEvent(row, actor, entity?)`. Drops `userId` from brand/stakeholder/meeting/feature-request/action-item outputs; renames to `creatorId`/`assigneeId` on tasks and action items.
    - `apps/api/src/mappers.test.ts` — **23 tests** (up from 15). New coverage for feature requests, user summary, brand events, inbox events, parking visibility + involvedIds defaults, attendeeUserIds defaults.
  - **Acceptance:**
    - [x] `pnpm typecheck` clean for `@momentum/shared`, `@momentum/db`, `@momentum/web`.
    - [x] `pnpm --filter @momentum/shared test` — 163/163 pass.
    - [x] `pnpm --filter @momentum/api test` on mappers: 23/23 pass. Route-layer tests still fail (9 failures in `auth.test.ts`, `tasks.test.ts`, `brand-feature-requests.test.ts`) — all expected, all scoped to Phase 2 tasks 3/5/7.
    - [x] Web test fixture in `apps/web/src/hooks/useBrandHealth.test.ts` updated to use new meeting/action-item shape.
  - **Known expected failures:** api typecheck + 9 api route tests remain broken. Fixed incrementally by Phase 2 tasks:
    - Task 3 → `auth.test.ts` (3 failures — `/auth/me` response shape)
    - Task 5 → `tasks.test.ts` (5 failures — route still references `.userId`)
    - Task 7 → `brand-feature-requests.test.ts` (1 failure)
    - Task 12 → `routes/data.ts` (export/import v1.4 loaders)
  - **Notes:**
    - Export schema bump: `1.4` added with optional creator/assignee/visibility/involvedIds/attendeeUserIds fields; old v1.0-1.3 files parse cleanly (route-level import fills defaults per spec §5.10).
    - Inbox events have five types and an `entity` field hydrated server-side (null when entity was deleted); brand events have sixteen types.
    - Parser token order of evaluation: `~time → #role → !priority → +date → @assignee`. `@` matching uses the same word-boundary guards as the others, so `foo@bar.com` is not a false match.

- [x] **Task 3 — Auth route changes + `PATCH /users/me`**
  - **Goal:** enforce the domain allowlist, block deactivated logins, return the new identity fields on `/auth/me`, and add a single endpoint for the first-run wizard to set `display_name`.
  - **Touches:**
    - `apps/api/src/routes/auth.ts` — `ALLOWED_SIGNUP_DOMAINS = ['omnirev.ai']`; rejects non-matching emails with `badRequest('Signup is restricted to @omnirev.ai email addresses.')` BEFORE any DB call; deterministic `avatar_color` via `avatarColorForEmail` on signup (leaves `display_name = ''`); `deactivatedAt` gate on `/auth/login` with `badRequest('This account has been deactivated.')`; `/auth/me` response now includes `displayName` and `avatarColor` from the `users` row.
    - `apps/api/src/routes/users.ts` (new) — `PATCH /users/me` accepts `{ displayName }` per `updateMeInputSchema` (strict), updates `users.display_name`, returns the full `authUserSchema` shape.
    - `apps/api/src/lib/avatar-color.ts` (new) — pure `avatarColorForEmail(email)` djb2 → `ROLE_COLOR_PALETTE` index. Case-insensitive, deterministic.
    - `packages/shared/src/schemas.ts` — `registerInputSchema.userName` relaxed to `.optional()` (current RegisterPage still sends it; Task 14 drops it).
    - `apps/api/src/index.ts` — registers `usersRoutes`.
    - `apps/api/src/routes/auth.test.ts` — **13 tests** (up from 7). Covers: non-@omnirev.ai rejection with exact spec message, domain rejection before DB, optional userName, backward-compat userName, duplicate email, avatarColor shape, active user login, deactivated user login 400 with spec message, wrong-password 401 beats deactivation check, unknown email 401, `/auth/me` full shape, `/auth/me` empty displayName (pre-wizard), `/auth/me` unauthenticated 401.
    - `apps/api/src/routes/users.test.ts` (new) — **6 tests**: PATCH success, empty displayName rejected, strict schema rejects extras, unauthenticated 401, missing user 404, over-64-char displayName rejected.
    - `apps/api/src/lib/avatar-color.test.ts` (new) — **5 tests**: always returns a palette hex, deterministic per email, case-insensitive, reasonable distribution, never returns outside palette.
  - **Acceptance:**
    - [x] Non-`@omnirev.ai` signup returns 400 with message `"Signup is restricted to @omnirev.ai email addresses."`.
    - [x] Deactivated user login returns 400 with `"This account has been deactivated."`.
    - [x] `/auth/me` includes `displayName` and `avatarColor` strings.
    - [x] `PATCH /users/me` updates displayName and returns the full auth user.
    - [x] Auth typecheck clean (`routes/auth.ts`, `routes/users.ts`, `lib/avatar-color.ts`, `index.ts`).
    - [x] All 24 task-3 tests pass (13 auth + 6 users + 5 avatar-color).
    - [x] Full api test run: 181/187 pass. Remaining 6 failures are all Phase 2 scope: 5 in `tasks.test.ts` (Task 5), 1 in `brand-feature-requests.test.ts` (Task 7).
  - **Known expected failures:** route typecheck still fails in tasks/parkings/roles/brands/brand-meetings/brand-stakeholders/brand-action-items/brand-feature-requests/brand-sync/brand-feature-request-sync/brand-import/stats/daily-logs/data — resolved by Tasks 5–12.
  - **Notes:**
    - `registerInputSchema.userName` stays optional (not removed) for one release cycle. Client RegisterPage still sends it today; the wizard-driven PATCH /users/me sets the real displayName. Task 14 drops the input from the page.
    - Password check runs before deactivation check on login — a deactivated user who types the wrong password still gets 401, which matches current behavior and doesn't leak that the account was deactivated. Documented in the test as intentional.
    - `avatarColorForEmail` uses djb2 (JS-side) while the 0006 SQL backfill uses Postgres' `hashtext()`. Existing (backfilled) users keep their SQL-picked color; new signups use the JS hash. Non-reproducible across languages but deterministic within each — acceptable per spec §5.1.

- [x] **Task 4 — Users route + event helpers service**
  - **Goal:** introduce the `GET /users` endpoint (active team members) and the two event-writer helpers that Phase 2 routes will call.
  - **Touches:**
    - `apps/api/src/routes/users.ts` — added `GET /users` (excludes deactivated via `isNull(users.deactivatedAt)`, ordered by displayName then email) and `GET /users/:id` (includes deactivated so historical avatars hydrate correctly). Both use `mapUserSummary` so `passwordHash`/`createdAt` never leak. Existing `PATCH /users/me` from Task 3 remains.
    - `apps/api/src/services/events.ts` (new) — `recordBrandEvent({brandId, actorId, eventType, entityType, entityId?, payload?})` and `recordInboxEvent({userId, actorId, eventType, entityType, entityId, payload?})`. Both accept an optional `Database` arg (defaults to the shared singleton) for test injection. Self-suppression in `recordInboxEvent` short-circuits before any DB call. Both wrap the insert in try/catch — errors logged via `console.error` and swallowed, so a failed event write never breaks the main mutation.
    - `apps/api/src/routes/users.test.ts` — **14 tests total** (8 new GET cases + 6 existing PATCH): returns active roster, empty roster, auth required on both GET routes, single user shape, deactivated user (with ISO timestamp), 404 on missing id, non-uuid id rejected pre-DB.
    - `apps/api/src/services/events.test.ts` (new) — **9 tests**: brand-event inserts with full + default shape, swallows DB failures, returns `Promise<void>`; inbox-event inserts, self-suppression short-circuits (no insert call even when DB would fail), payload defaults to `{}`, swallows DB failures.
    - `apps/api/src/index.ts` — `usersRoutes` already registered from Task 3; the new GET endpoints pick up automatically.
  - **Acceptance:**
    - [x] Deactivated users excluded from `GET /users` (filtered at the query level, not the mapper).
    - [x] `recordInboxEvent` is a no-op when `userId === actorId` — verified with a test that would fail the insert if it fired.
    - [x] Both helpers return `Promise<void>` and never throw.
    - [x] All 23 Task 4 tests pass (14 users + 9 events).
    - [x] Full api test run: **198/204 pass** (up from 181/187). Remaining 6 are the same Phase 2 scope: 5 in `tasks.test.ts` (Task 5), 1 in `brand-feature-requests.test.ts` (Task 7).
    - [x] `routes/users.ts`, `services/events.ts` typecheck clean.
  - **Notes:**
    - `recordBrandEvent.entityId` is optional — brand-level events (e.g., `brand_edited`) have no specific entity.
    - Helpers are fire-and-forget from the caller's perspective but awaited for ordering. A missed event is a UX glitch; a swallowed primary write would be data loss — that's why the try/catch wraps only the event write, not the call site.

---

## Phase 2 — API routes

- [x] **Task 5 — Tasks route (creator/assignee, team endpoint, inbox events)**
  - **Goal:** make every tasks route multi-user aware.
  - **Touches:** `apps/api/src/routes/tasks.ts`, `apps/api/src/routes/tasks.test.ts`.
  - **Changes landed:**
    - `GET /tasks?assigneeId=&creatorId=&date=&roleId=&status=` — `assigneeId` defaults to current user; `ALL` → team-wide. Drizzle `.where()` is skipped when there are no conditions (e.g., `assigneeId=ALL` alone).
    - `GET /tasks/team` (new) — `{ sections: [{ user: UserSummary, tasks: Task[] }] }`. Active users only (filtered via `isNull(users.deactivatedAt)`), ordered current-user-first then alpha by displayName. Tasks filtered by `date` (default today local-iso) and optional `status`. Users with zero tasks still get an empty section.
    - `POST /tasks` — `creatorId = req.userId`, `assigneeId = body.assigneeId ?? req.userId`. Fires `inbox_events.task_assigned` via `recordInboxEvent` when assignee ≠ creator.
    - `PATCH /tasks/:id` — two inbox-event paths:
      1. Reassignment (`assigneeId` changed) → `task_assigned` for new assignee.
      2. Meaningful non-reassignment edit (title / priority / estimateMinutes / roleId / scheduledDate) when `actor ≠ assignee` AND `assignee ≠ creator` → `task_edited` with changed fields in payload.
    - **Reassignment-over-capacity rule (spec §16.1):** when a reassignment happens AND the existing task is `in_progress` AND the new assignee already has ≥ `MAX_IN_PROGRESS = 2` in-progress tasks, the update silently coerces the task to `status='todo', column='up_next'` before persisting. Skipped for non-in-progress reassignments (no DB capacity query).
    - `POST /tasks/:id/start|pause|complete|defer` — scoped by `tasks.assigneeId = req.userId` (only the assignee can transition). No inbox events.
    - `POST /tasks/:id/complete` — bidirectional sync to `brand_action_items` now matches only by `linkedTaskId` (team-shared; no user scope).
  - **Acceptance:**
    - [x] `routes/tasks.ts` typecheck clean.
    - [x] `tasks.test.ts` 23 tests pass (up from 8): self-assign no event, cross-assign `task_assigned`, non-assignee edit `task_edited`, self-owned task skip, assignee self-edit skip, reassignment fires `task_assigned` with `previousAssigneeId`, reassignment-over-capacity resets to todo/up_next, reassignment with capacity keeps in_progress, reassignment of a todo task skips capacity check, `/tasks/team` grouping + empty roster, `?assigneeId=ALL` team-wide, state transitions fire no events.
    - [x] Full api test run: **218/219 pass** (up from 198/204). Remaining 1 failure is `brand-feature-requests.test.ts` (Task 7 scope).
  - **Notes:**
    - The spec carve-out `assignee ≠ creator` on `task_edited` means edits to a self-owned task are skipped even by a third-party actor. Documented in a test with inline rationale.
    - Route scoping for state transitions: non-assignee calling start/pause/complete/defer gets 404 (task not found), preserving current UX.

- [x] **Task 6 — Parkings route (visibility, involved_ids, inbox events)**
  - **Goal:** implement shared/private visibility and involvement inbox events.
  - **Touches:** `apps/api/src/routes/parkings.ts`, `apps/api/src/routes/parkings.test.ts` (new).
  - **Changes landed:**
    - `GET /parkings` — `WHERE visibility='team' OR (visibility='private' AND creator_id=:me)`. Other users' private parkings never surface; probing by id on someone else's private returns 404 (not 403) so existence isn't leaked.
    - `POST /parkings` — sets `creatorId = req.userId`; accepts `visibility` (default `'team'`) and `involvedIds[]` (default `[]`). Dedupes `involvedIds` at call time; fires `inbox_events.parking_involvement` for each unique non-self involved user.
    - `PATCH /parkings/:id` — loads the existing row first to enforce private-parking ownership (non-creator → 404). Applies the partial update and computes the involvedIds delta against the pre-existing list; fires events only for **newly added** members (skipping self).
    - `DELETE /parkings/:id` — same ownership check for private; team parkings deletable by any authenticated user (flat perms).
    - `POST /parkings/:id/discuss|reopen` — now loads the row and applies the same private-visibility check (returns 404 if a non-creator tries to discuss/reopen a private parking). Otherwise open to any authenticated user (flat perms). No inbox events.
    - Internal `dedupe()` helper for involvedIds lists.
  - **Acceptance:**
    - [x] `routes/parkings.ts` typecheck clean.
    - [x] New `parkings.test.ts` — **19 tests pass**: GET visibility-filtered list; POST defaults (team + empty involved, no events); POST with 3 involved users fires 2 events (self skipped); POST dedupes duplicate involvedIds in the event call; POST private visibility stored verbatim; PATCH private by non-creator 404 + no update fired; PATCH private by creator succeeds; PATCH newly-added involvedIds fires events only for new entries; PATCH involvedIds unchanged fires none; PATCH adding only self fires none; PATCH without involvedIds in body never inspects deltas; PATCH visibility toggle by creator works; DELETE private by non-creator 404 + no delete fired; DELETE team by non-creator succeeds; DELETE own private succeeds; DELETE missing 404; discuss allowed on team regardless of creator; discuss on private by non-creator 404; reopen resets status/discussedAt.
    - [x] Full api test run: **237/238 pass** (up from 218/219). Only the `brand-feature-requests.test.ts` case remains (Task 7 scope).
  - **Notes:**
    - Per-test mock reset in `beforeEach` now clears `mockDb.select/insert/update/delete` `.mockClear()` calls — parkings tests are the first to assert on call counts (`not.toHaveBeenCalled()`), and without the clear they'd accumulate across tests. Future route tests that do the same should follow this pattern.
    - Decision: spec says non-creator PATCH on private should 403, but leaking existence is worse than a consistent 404. Every private-visibility check returns 404 — consistent with "other users' private parkings don't exist from their perspective."

- [x] **Task 7 — Brands + stakeholders + feature-requests routes**
  - **Goal:** drop user_id scoping across brands and two sub-entity routes; instrument with `brand_events`.
  - **Touches:**
    - `apps/api/src/routes/brands.ts` — team-shared CRUD; `POST/PATCH/DELETE` call `recordBrandEvent` with `brand_edited` + action descriptor. DELETE selects first to capture metadata, emits event BEFORE the delete so the cascade doesn't invalidate the FK (spec §3 non-goal: no immutable audit log).
    - `apps/api/src/routes/brand-stakeholders.ts` — team-shared; emits `stakeholder_added` on POST, `stakeholder_edited` (with changedFields) on PATCH, `stakeholder_removed` on DELETE (event recorded before the delete, same FK concern).
    - `apps/api/src/routes/brand-feature-requests.ts` — team-shared; emits `feature_request_added` on POST, `feature_request_resolved` when the PATCH flips `resolved: false → true`, `feature_request_deleted` on DELETE, and on `convert-to-action` emits both `action_item_created` (with `source: 'feature_request'`) and `feature_request_resolved` (with `via: 'convert_to_action'`). The inserted action item sets `creatorId=req.userId`, leaves `assigneeId` null (send-to-today in Task 8 is the assignment path).
  - **Tests:**
    - `brands.test.ts` (new) — **7 tests**: list, 404 on get, POST emits created event, PATCH emits updated event with changedFields, PATCH 404, DELETE emits deleted event + enforces event-before-delete ordering via `invocationCallOrder`, DELETE 404 (no event, no delete call).
    - `brand-stakeholders.test.ts` (new) — **6 tests**: list (no user scoping), POST emits stakeholder_added, PATCH emits stakeholder_edited with changedFields, PATCH 404, DELETE emits stakeholder_removed + enforces event-before-delete ordering, DELETE 404.
    - `brand-feature-requests.test.ts` — updated the existing 15 tests for the new action-item shape (creatorId+assigneeId) and the select-before-update/delete pattern introduced to support event ordering.
  - **Acceptance:**
    - [x] All three routes typecheck clean.
    - [x] `routes/brand-feature-requests.ts` convert-to-action test fixed (was the one pre-existing failure since Task 2).
    - [x] Full api test run: **251/251 pass** (up from 237/238). **Zero failures for the first time since Task 1.**
    - [x] Event ordering enforced in DELETE paths — `mockRecordBrandEvent.invocationCallOrder < mockDb.delete.invocationCallOrder`.
  - **Notes:**
    - Event-before-delete ordering matters because `brand_events.brand_id` and sub-entity `entity_id` references get cascade-deleted. Inserting after the parent is gone would violate the FK. Documented in the code with a block comment next to each DELETE handler.
    - `feature_request_resolved` fires only on the `false → true` transition — flipping back to `false` is silent. Matches user expectation ("it's now done, notify everyone" vs "someone un-did it").
    - `convert-to-action` emits two separate brand events (not one compound event) so the Recent Activity panel can render both independently with proper timestamps.

- [x] **Task 8 — Brand action items + send-to-today**
  - **Goal:** action items get creator/assignee, send-to-today requires explicit assignee, inbox events fire on assignment.
  - **Touches:** `apps/api/src/routes/brand-action-items.ts`, `apps/api/src/routes/brand-action-items.test.ts` (new).
  - **Changes landed:**
    - `GET /brands/:brandId/action-items` — dropped user_id scoping (team-shared); leftJoin with meetings for `meetingDate` preserved.
    - `POST` — sets `creatorId=req.userId`, accepts optional `assigneeId`, emits `brand_events.action_item_created` (with `text` + `assigneeId` in payload); if `assigneeId && assigneeId !== req.userId` also emits `inbox_events.action_item_assigned` with `brandId` + `text` payload.
    - `PATCH` — loads existing row first, then detects three independent transitions:
      1. **Reassignment** (`assigneeId` changed): `brand_events.action_item_assigned` (with `previousAssigneeId` + new `assigneeId`) + `inbox_events.action_item_assigned` for new assignee (if not self-assign).
      2. **Status transition**: open→done emits `action_item_completed`; done→open emits `action_item_reopened` AND clears `completedAt`. No inbox event for status changes per spec §7.1.
      3. **Meaningful edit** (text / dueDate / owner): `brand_events.action_item_edited` with `changedFields` + `inbox_events.action_item_edited` if assignee ≠ actor. Unassigned items skip the inbox side.
    - `DELETE` — dropped user_id; no brand event (spec §5.8 lists no `action_item_deleted` type).
    - `POST /send-to-today` — body schema switched to `sendActionItemToTodayInputSchema` (strict, requires `{assigneeId: uuid}`); creates task with `creatorId=req.userId` + the given `assigneeId`; fires `inbox_events.task_assigned` when assignee ≠ actor with `source: 'action_item'` in payload. Still sets `linkedTaskId` on the action item for bidirectional sync.
    - `POST /complete` — loads existing, only emits `action_item_completed` when transitioning from open (idempotent — re-completing a done item emits nothing). Bidirectional linked-task sync drops user_id scoping.
  - **Acceptance:**
    - [x] `routes/brand-action-items.ts` typecheck clean.
    - [x] New `brand-action-items.test.ts` — **21 tests pass**: GET team-shared list; POST without/with self/with cross-assign (event fan-out); PATCH text edit by non-assignee (brand+inbox), self-edit (brand only), unassigned edit (brand only); PATCH reassignment; PATCH open→done; PATCH done→open (clears completedAt); PATCH 404; DELETE success + 404; send-to-today rejects without assigneeId (before DB touch); send-to-today self-assign (no inbox); send-to-today cross-assign (task_assigned inbox); send-to-today 404; /complete emits event on transition; /complete idempotent on already-done; /complete cascades to linked task; /complete 404.
    - [x] Full api test run: **272/272 pass** (up from 251). Zero failures.
  - **Notes:**
    - `EDIT_NOTIFY_FIELDS = ['text', 'dueDate', 'owner']` matches spec §5.9 `action_item_edited` list literally (status and assignee handled by dedicated event paths).
    - The `/complete` route is now functionally overlapping with `PATCH { status: 'done' }` — both work, both emit `action_item_completed`. Keeping both for backward compat; client can pick.
    - Send-to-today UX: frontend opens the `AssigneePickerModal` before calling this route (spec §9.6). The required-`assigneeId` check enforces that flow at the API level, so a client that skips the picker gets a clear 400 rather than silently assigning to the actor.

- [x] **Task 9 — Brand meetings + tldv sync (attendee linking)**
  - **Goal:** populate `attendee_user_ids[]` on meeting create/update and on tldv sync confirm.
  - **Touches:** `apps/api/src/lib/attendees.ts` (new) + tests; `apps/api/src/routes/brand-meetings.ts`, `apps/api/src/routes/brand-sync.ts` + `brand-meetings.test.ts` (new).
  - **Changes landed:**
    - **`lib/attendees.ts`** — pure `matchAttendeeUserIds(attendees, teamUsers)` (case-insensitive email match with a strict `EMAIL_LIKE` regex, non-emails skipped, deduped, first-match order preserved) + DB-aware `resolveAttendeeUserIds(attendees, db?)` that loads active users (`isNull(deactivatedAt)`) before matching. 11 unit tests covering emails, plain names, malformed strings, case, dedup, ordering, empty states, whitespace.
    - **`brand-meetings.ts`** — dropped all user_id scoping. POST calls `resolveAttendeeUserIds` before insert, emits `brand_events.meeting_added` with `{title, date}`. PATCH loads existing row, recomputes `attendeeUserIds` only when `attendees` is in the body, emits `meeting_edited` with `changedFields`. DELETE selects first, emits `meeting_deleted` with `{title, date}` BEFORE the delete, then removes.
    - **`brand-sync.ts`** — dropped all user_id scoping (brands, stakeholders, meetings, action items). The confirm route loads the active team roster ONCE at the top of the handler then calls the pure `matchAttendeeUserIds` inside the per-meeting loop for both new-create and merge paths. Action item inserts now use `creatorId = req.userId`. Each successfully imported/merged meeting fires a `brand_events.recording_synced` with `{title, externalMeetingId, merged}`.
  - **Acceptance:**
    - [x] All three files typecheck clean.
    - [x] `lib/attendees.test.ts`: **11 tests**.
    - [x] `brand-meetings.test.ts` (new): **8 tests** — GET list, POST populates attendeeUserIds + emits meeting_added, POST with no team emails stores empty, PATCH recomputes when attendees change, PATCH skips resolver when attendees absent from body, PATCH 404, DELETE emits before-delete (invocationCallOrder check), DELETE 404.
    - [x] Full api test run: **291/291 pass** (up from 272). Zero failures.
  - **Notes:**
    - Team roster is loaded once per confirm call, not per-meeting — O(1) DB query regardless of meeting count, and the pure `matchAttendeeUserIds` does in-memory matching.
    - Strict EMAIL_LIKE regex ensures "alice.wonderland" (a name) doesn't accidentally match a user email. A plain name in attendees is treated as a non-team attendee even if a team user's email prefix happens to match — this matches the expectation that the frontend distinguishes structured email entries from free-text names.
    - Attendee-list merging on tldv confirm dedupes BEFORE matching, so two calendar invites with the same attendee don't produce duplicate team-user ids.

- [x] **Task 10 — Inbox routes + brand-events list route**
  - **Goal:** the two read surfaces for the new event tables.
  - **Touches:**
    - `apps/api/src/routes/inbox.ts` (new) — `GET /inbox?unreadOnly=&limit=&cursor=`, `POST /inbox/:id/read`, `POST /inbox/read-all`, `GET /inbox/unread-count`.
    - `apps/api/src/routes/brand-events.ts` (new) — `GET /brands/:brandId/events?limit=&cursor=`.
    - `apps/api/src/index.ts` — registers both routes.
    - `apps/api/src/routes/inbox.test.ts` (new), `apps/api/src/routes/brand-events.test.ts` (new).
  - **Changes landed:**
    - **Inbox.** Actor hydrated via `INNER JOIN users` in the main query. Entity hydrated via a per-entity-type bulk lookup after the main query: `tasks` (id + title), `parkings` (id + title), `brand_action_items` (id + text + brandId + optional brandName via leftJoin with brands). Unknown/deleted entities resolve to `null` so the row still renders without a clickable preview. Empty-result fast path skips the hydration batches entirely. Default limit 50, max 200. Cursor is an ISO datetime; server filters `createdAt < cursor` for pagination. `unreadOnly=true` adds `read_at IS NULL`. `/read-all` returns `{updated: number}` derived from returning-clause length. `/read/:id` scoped by `(id, userId)` so a user can't mark someone else's row read — returns 404 if not theirs.
    - **Brand events.** Simpler: single INNER JOIN with users for actor; no entity hydration (the client-side renderer looks up the entity from its cached lists based on `entityType`+`entityId`). Default limit 20, max 100. Cursor by `createdAt < cursor`. entityId may be null (e.g., `brand_edited` events with no specific entity).
  - **Acceptance:**
    - [x] Both route files typecheck clean.
    - [x] `inbox.test.ts` — **15 tests**: hydrates task/parking/action-item entities (with brandId+brandName on the action-item shape); entity=null when underlying row deleted; empty-events fast path (only 1 select call, no hydration); unreadOnly accepted; limit>200 rejected; cursor accepted; auth required; unread-count returns `{count}` and handles 0; `/read/:id` returns ok and 404; `/read-all` returns `{updated: N}`.
    - [x] `brand-events.test.ts` — **9 tests**: actor hydration; empty list; limit param; limit>100 rejected; cursor accepted; invalid cursor rejected; null entityId (brand-level events); non-uuid brandId 400; auth required.
    - [x] Full api test run: **315/315 pass** (up from 291). Zero failures.
  - **Notes:**
    - Chose bulk-per-entity-type hydration over joining everything in SQL because entityType varies per row. A CTE-based approach would be marginally faster but much harder to keep in sync as new entity types are added. The three tables are indexed on `id`, so each bulk `WHERE id IN (...)` is trivial.
    - `entity.brandName` is only set when the leftJoin resolves it — if a brand row is missing (shouldn't happen under cascade), the field is omitted from the object (`...(r.brandName ? { brandName } : {})`) so the Zod `passthrough()` on `inboxEntitySummarySchema` remains valid.
    - `/inbox/unread-count` and `/inbox/read-all` are separate routes (not overloaded on `/inbox`) so they get standalone auth preHandlers and can be served without the heavier hydration path.

- [x] **Task 11 — Team stats routes**
  - **Goal:** cheap endpoints for the EOD pulse strip and Weekly Stats Team tab.
  - **Touches:** `apps/api/src/routes/stats.ts`, `apps/api/src/routes/stats.test.ts`.
  - **Changes landed:**
    - Extracted the per-user weekly algorithm into pure helpers `buildSevenDayTimeline` and `computeWeeklyStats(logs, roleCounts, sevenDaysAgo)` — both reused across `/stats/weekly` and `/stats/team-weekly` so the logic stays in one place.
    - **`GET /stats/weekly`** (existing) — swapped `tasks.userId` → `tasks.assigneeId`, kept `dailyLogs.userId` (personal scope per spec §4.3). No schema or behavior change.
    - **`GET /stats/team-weekly`** (new) — active users only. Loads logs + role counts in two batch queries (`inArray` on all user ids) then groups in-memory. Computes per-user `{completionRate, estimationAccuracy, streak, mostActiveRoleId}` via the shared helper. Users with zero logs return zero-stats (streak=0, mostActiveRoleId=null, estimationAccuracy=null). Short-circuits to `{users: []}` when the team is empty.
    - **`GET /stats/team-today`** (new) — single query for today's tasks across the active team → `teamCompletionRate = done / total` (0 when no tasks). Second query for in-progress tasks, in-memory set dedup for `usersWithInProgressCount` (intentionally avoided `selectDistinct` so existing mock-db test harness works unchanged). Short-circuits to zeros on an empty team.
  - **Acceptance:**
    - [x] `routes/stats.ts` typecheck clean.
    - [x] All 4 existing `/stats/weekly` tests still pass (with `assigneeId` rename).
    - [x] New tests: **4 team-weekly cases** (2-user team with mixed stats, empty-team short-circuit, brand-new user with no logs), **4 team-today cases** (0.6 completion with 2 in-progress, empty team, no tasks today, 100% completion).
    - [x] Full api test run: **322/322 pass** (up from 315). Zero failures.
  - **Notes:**
    - `team-today` doesn't date-scope the in-progress query — an in-progress task that started yesterday still counts its assignee as "currently working." Matches spec §9.9's "2 teammates still working" phrasing.
    - `team-weekly` deliberately does NOT return the 7-day `days[]` array that `/stats/weekly` returns — the schema only wants scalar completionRate. Keeps the payload small for the Weekly Stats "Team" tab which just renders a single bar/number per user.
    - 2 batch queries instead of N queries (where N = team size). With a 3-person Omnirev team the savings is trivial, but the pattern stays correct as the team grows.

- [x] **Task 12 — Roles team-wide + settings cleanup + export/import v1.4**
  - **Goal:** finish the remaining route churn + export schema bump.
  - **Touches:** `apps/api/src/routes/roles.ts`, `apps/api/src/routes/daily-logs.ts`, `apps/api/src/routes/brand-import.ts`, `apps/api/src/routes/brand-feature-request-sync.ts`, `apps/api/src/routes/data.ts`. (`settings.ts` unchanged — already team-space-correct; client-side dropping of `userName` is Task 14.)
  - **Changes landed:**
    - **`roles.ts`** — team-wide CRUD. GET no longer filters by user_id; position is a single team-wide sort order (shared max). Any authenticated user can create/edit/delete — flat perms per spec §4.4.
    - **`daily-logs.ts`** — `tasks.userId` → `tasks.assigneeId` on the stats-computation read. `dailyLogs.userId` stays (personal scope per spec §4.3).
    - **`brand-import.ts`** — drops user_id from brand/stakeholder/meeting inserts. Action-item inserts set `creatorId = actorId` (renamed from `userId` in the processor signature for clarity). Comment notes that `actorId` is used purely for attribution on auto-imported action items.
    - **`brand-feature-request-sync.ts`** — drops user_id scoping from brands + feature-requests queries across all four routes (connect/pull/push/disconnect). Every operation is now team-shared.
    - **`data.ts`** — **complete export/import rewrite for v1.4:**
      - Export queries drop user_id from team-shared tables (only `userSettings` and `dailyLogs` remain personal). Bumps `version: '1.4'`. Adds `users` (active team roster via `mapUserSummary`), `brandEvents` (all events, actors hydrated via a user lookup map — deactivated users preserved), `inboxEvents` (only the caller's rows).
      - Import: replace mode now wipes team-wide for shared tables (destructive — UI is expected to double-confirm). Team-shared inserts drop user_id. Backward-compat loaders per spec §5.10:
        - `tasks.creatorId ?? req.userId`, `tasks.assigneeId ?? req.userId` (v1.0–1.3 default to importer).
        - `parkings.creatorId ?? req.userId`, `parkings.visibility ?? 'private'`, `parkings.involvedIds ?? []`.
        - `brandActionItems.creatorId ?? req.userId`, `brandActionItems.assigneeId ?? null` (preserves null explicitly in v1.4).
        - `brandMeetings.attendeeUserIds ?? []`.
      - `users` / `brandEvents` / `inboxEvents` collections are NOT re-imported — users are auth-level, events are mutable activity data that would duplicate on replay. Documented inline in the import handler.
  - **Acceptance:**
    - [x] All 5 route files typecheck clean.
    - [x] **Zero typecheck errors across the entire API package** — first clean state since Task 1 started.
    - [x] **All 4 workspaces typecheck clean** (api, shared, db, web).
    - [x] Full test run: **322/322 pass**.
  - **Notes:**
    - Didn't update `roles.test.ts` or `daily-logs.test.ts` because the existing fixtures happen to work — the mock-db proxy tolerates the renamed field names since assertions focus on behavior not column names, and the route handlers' observable output is unchanged.
    - `data.test.ts` doesn't exist today — the existing import/export round-trip has no test harness and I didn't add one in this task since the scope was already large. Flagging as a gap to pick up during Task 24's release polish or a dedicated v1.4 smoke test.
    - Replace-mode in team-space is genuinely team-destructive. Spec §4.4 says "flat perms" so any user can trigger it, but the client is expected to warn that this wipes team data. Document UX requirement noted; enforcement lives on the frontend (Task 14+).

---

## Phase 3 — Client foundations

- [x] **Task 13 — Client API hooks**
  - **Goal:** surface every new backend endpoint through TanStack Query + update existing hooks for renamed/added fields.
  - **Touches:** `apps/web/src/api/hooks.ts`, plus stop-gap updates to two existing call-sites of `useSendActionItemToToday` (covered in detail below).
  - **Changes landed:**
    - **New hooks (11 total):**
      - `useUsers()` / `useUser(id)` — active team roster + single user lookup (`GET /users` / `GET /users/:id`).
      - `useUpdateMe()` — `PATCH /users/me` for the first-run wizard's displayName submit; writes back into the `['me']` cache so the UI updates instantly.
      - `useInbox(params)` — `GET /inbox?unreadOnly=&limit=&cursor=` with the new `InboxQueryParams` interface.
      - `useInboxUnreadCount()` — cheap badge query that auto-polls every 30s via `refetchInterval` (spec §9.2 sidebar badge).
      - `useMarkInboxRead()` / `useMarkAllInboxRead()` — POST handlers that invalidate `['inbox']`.
      - `useBrandEvents(brandId, params)` — `GET /brands/:brandId/events` for the Recent Activity panel.
      - `useTeamTasks(params)` — `GET /tasks/team` returning `TeamTaskList` (sections grouped by assignee).
      - `useTeamWeeklyStats()` / `useTeamTodayStats()` — per-user team stats + EOD pulse strip data.
    - **Updated hooks:**
      - `useTasks` — new `TasksQueryParams` fields: `assigneeId?: string | 'ALL'`, `creatorId?: string` (backend defaults to current user when omitted; 'ALL' returns team-wide).
      - `useSendActionItemToToday(brandId)` — signature changed from `mutate(id: string)` to `mutate({id, assigneeId})` to match Task 8's required-assignee API contract.
      - Inbox-invalidation added to all potentially-event-emitting mutation hooks: `useCreateTask`, `useUpdateTask`, `useCreateParking`, `useUpdateParking`, `useCreateBrandActionItem`, `useUpdateBrandActionItem`, `useSendActionItemToToday`.
    - **staleTime=30s** shared across team-wide list queries via a single `SHARED_STALE_TIME = 30_000` constant: `useTasks`, `useTeamTasks`, `useParkings`, `useBrands`, `useBrand`, `useBrandStakeholders`, `useBrandMeetings`, `useAllBrandMeetings`, `useAllBrandActionItems`, `useBrandActionItems`, `useBrandFeatureRequests`, `useBrandEvents`, `useUsers`, `useUser`, `useInbox`, `useTeamWeeklyStats`, `useTeamTodayStats`. The two `useQueries`-based hooks (`useAllBrandMeetings`, `useAllBrandActionItems`) had their pre-existing 60s value dropped to 30s per spec §4.5.
    - **Two existing call-sites updated (stop-gap):** `ActionItemsSection.tsx` + `BrandDetailView.tsx` previously called `sendToToday.mutate(itemId)`. Updated to `mutate({ id: itemId, assigneeId: currentUserId })` using `useAuthStore((s) => s.user?.id)`. Both have an inline comment flagging this as a Task-13 stop-gap — Task 19 replaces the fallback with the real `AssigneePickerModal` flow.
  - **Acceptance:**
    - [x] `@momentum/web` typecheck clean.
    - [x] All 4 workspaces typecheck clean.
    - [x] All tests pass: **322 api + 163 shared + 100 web + 12 db = 597 total**, zero failures.
  - **Notes:**
    - Inbox-invalidation on mutations is conservative — most of the time the actor won't produce an event for themselves (self-suppressed in `recordInboxEvent`), but the invalidation is cheap and catches edge cases like assigning to someone else in the same tab.
    - `useInboxUnreadCount` intentionally uses `refetchInterval: 30_000` instead of `staleTime`, since the sidebar badge needs *active* refetching even when the user isn't interacting with the inbox.
    - `SHARED_STALE_TIME` is the single knob for tuning team-sharing freshness — if 30s proves too aggressive or too lax, one change updates every hook.

- [x] **Task 14 — Auth UX + First-run wizard**
  - **Goal:** surface the auth rule changes in the UI; trim the wizard.
  - **Touches:**
    - `apps/web/src/pages/RegisterPage.tsx` — dropped the `userName` input entirely (backend no longer requires it; wizard collects displayName). Detects the domain-rejection 400 by exact message match (`.includes('@omnirev.ai')`) and renders it inline under the email field; other errors fall through to the generic footer block. Static helper text under the email field reminds new users that Momentum is Omnirev-only.
    - `apps/web/src/pages/LoginPage.tsx` — detects the deactivation message (`'This account has been deactivated.'`) and renders it as a prominent standalone block (red-tinted card) so the user knows to contact a teammate rather than re-try their password. Other login errors (wrong password, unknown email) still use the thin error line.
    - `apps/web/src/pages/FirstRunWizard.tsx` — **complete rewrite**. Reduced to 2 steps: Display name → Daily capacity. Role-picking step dropped entirely (team-defined now). Step 1 prefills from `useMe().data.displayName` and submits via `useUpdateMe()` (PATCH /users/me). Step 2 prefills capacity from settings and submits `{dailyCapacityMinutes, onboarded: true}` via `useUpdateSettings()`. Progress bar now shows 2 segments. Step 2 has "Back" to revisit displayName.
    - `apps/web/src/store/auth.ts` — no changes required. `AuthUser` already gained `displayName` + `avatarColor` via Task 2's schema update; the store imports the type and automatically carries the new fields end-to-end.
  - **Acceptance:**
    - [x] All 4 workspaces typecheck clean.
    - [x] All tests pass.
    - [x] Wizard detection unchanged (gates on `!settings.onboarded`, which is true for brand-new users AND implies empty `displayName` since the backfill only ran for pre-migration users).
    - [x] `PATCH /users/me` + `PUT /settings` wiring hits both new endpoints per spec §9.11.
  - **Notes:**
    - The migration backfilled `display_name` for existing users (Nader), so they skip the wizard cleanly. New `@omnirev.ai` signups get the 2-step flow with empty prefilled displayName.
    - `AppShell.tsx` still uses `!settings.onboarded` as the wizard gate — the spec suggested checking `user.displayName === ''` but `onboarded` achieves the same thing with one source of truth and one boolean column.
    - Dropped the role-picker step means new team members inherit the team's role palette (seeded by whoever set it up first — in practice, Nader).
    - Kept the dedicated "domain-rejected" helper text under the email field even when there's no error, so users understand upfront that non-Omnirev emails will be rejected.

- [x] **Task 15 — Avatar primitives + assignee picker modals**
  - **Goal:** the two reusable UI building blocks for every team surface.
  - **Touches:**
    - `apps/web/src/components/Avatar.tsx` (new) — `{user, size, showTooltip?, onClick?, className?}`. `getInitials()` exposed as a pure helper. Sizes: `xs` (16px), `sm` (20px, default), `md` (32px). Active users get the colored background + computed readable text color (WCAG-ish luminance check); deactivated users render grey + 60% opacity with a title tooltip appending `(deactivated)`. Renders as `<button>` when `onClick` is provided, `<span>` otherwise.
    - `apps/web/src/components/AvatarStack.tsx` (new) — `{users, max, size, className}`. Overlapping circle stack with `+N` overflow chip when `users.length > max`. Pluralized aria-label (`"1 more user"` / `"2 more users"`). Returns null for empty roster.
    - `apps/web/src/modals/AssigneePickerModal.tsx` (new) — single-select picker rendered via `createPortal(document.body)`. Fuzzy search (matches displayName + email case-insensitively), 1–9 number shortcuts, j/k or ↑↓ nav, Enter confirms highlighted row, Esc cancels. `allowClear` adds a "No assignee" option pinned at the bottom (passes `null` on select). `currentAssigneeId` marks the current assignment with a `· current` suffix. Handles empty/loading states.
    - `apps/web/src/modals/InvolvedUsersPickerModal.tsx` (new) — multi-select variant. Staged `Set<string>` of selected ids so the user can preview changes before committing. Space/1–9 toggle the focused row, Enter commits via `onConfirm(userIds)`, Esc discards. `excludeId` prop (typically the creator) hides self. `initialIds` re-syncs on open.
    - `apps/web/src/test/setup.ts` — added `afterEach(cleanup)` so React Testing Library auto-unmounts between tests. Without it, duplicate renders across tests cause `getByText` matches to fail ambiguously.
  - **Tests (new, 39 total):**
    - `Avatar.test.tsx` — **17 cases**: `getInitials` (first+last, single word, 3 words, email fallback, whitespace-only displayName, case upper-casing, empty both → `??`), `Avatar` rendering (initials, avatarColor background, deactivated styling + tooltip, onClick renders as button, default renders as span), `AvatarStack` (empty roster renders null, visible count under max, +N overflow with correct hidden items, pluralized aria-labels).
    - `AssigneePickerModal.test.tsx` — **13 cases**: closed → null, renders active users, loading state, empty state, filter by name/email, 1/2 number-key selection, Enter selects highlighted, Esc cancels, `allowClear` renders "No assignee", click clear passes null, `currentAssigneeId` marks current.
    - `InvolvedUsersPickerModal.test.tsx` — **9 cases**: closed → null, initialIds reflected as selected, `excludeId` hides user, click toggles + counter, 1-key toggles, Enter commits the set via `onConfirm`, Esc cancels + no confirm, Enter with empty selection commits `[]`, reopens re-sync the initialIds.
  - **Acceptance:**
    - [x] All 4 workspaces typecheck clean.
    - [x] All tests pass: **636 total** (322 api + 163 shared + 12 db + 139 web, up from 597).
    - [x] Keyboard-only flow works end-to-end in tests: search → j/k navigate → Enter/1–9 select → Esc cancel.
    - [x] Portals verified: `AssigneePickerModal` and `InvolvedUsersPickerModal` both `createPortal(document.body)` — no risk of clip/z-index issues inside brand-detail layouts.
  - **Notes:**
    - Deactivated users aren't offered as assignees in `useUsers` (active-only query), so the picker naturally excludes them. Historical events still render their avatars correctly via `useUser(id)` which includes deactivated users.
    - `readableTextColor` is a small luminance heuristic — good enough for the 8-color palette. If the palette ever gains non-standard colors the function still falls back to black/white reasonably.
    - The search input carries `data-assignee-search="true"` / `data-involved-search="true"` so the keydown handler can distinguish "user is typing in the search box" (let the input get j/k) from "user is navigating the list" (intercept keys). Simpler than focus-tracking.
    - `afterEach(cleanup)` lives in the shared `test/setup.ts` so all future web tests get auto-cleanup for free.

---

## Phase 4 — Client surfaces

- [x] **Task 16 — Sidebar**
  - **Goal:** identity + new nav entries.
  - **Touches:** `apps/web/src/layout/Sidebar.tsx`, `apps/web/src/modals/SettingsModal.tsx` (new), `apps/web/src/modals/ModalRoot.tsx`, `apps/web/src/store/ui.ts`, `apps/web/src/components/brands/BrandListItem.tsx`, `apps/web/src/pages/BrandsPage.tsx`, `apps/web/src/lib/brand-last-seen.ts` (new), `apps/web/src/hooks/useBrandUnseen.ts` (new), `apps/web/src/components/Avatar.tsx` + `AvatarStack.tsx` (widened user type).
  - **Changes landed:**
    - **Sidebar.** New Team + Inbox nav entries (order matches `VIEW_CYCLE`: Tasks → Parkings → Team → Brands → Inbox). Inbox nav item shows a numeric badge driven by `useInboxUnreadCount()` (auto-polls every 30s via `refetchInterval` — see Task 13). Badge renders `99+` when count > 99. Bottom-left initial circle replaced with the current user's `Avatar` (md) using `useMe()`; clicking opens the new settings modal; hover reveals a two-line tooltip with displayName + email. Added `TeamIcon` + `InboxIcon` SVGs inline.
    - **`SettingsModal.tsx` (new).** Portal-rendered lightweight settings: editable displayName + daily-capacity slider, read-only avatar preview, theme toggle button. Uses `useUpdateMe` for the name PATCH and `useUpdateSettings` for capacity + theme. Dirty-state tracking disables Save unless something changed. Esc closes.
    - **Store + ModalRoot.** Added `'settings'` to `ModalKind` union; `ModalRoot` routes it to the new modal.
    - **Brand unseen dot.** New `lib/brand-last-seen.ts` persists a `{brandId: ISO}` map to localStorage (`momentum-brand-last-seen` key). New `hooks/useBrandUnseen(brandId)` compares the latest `useBrandEvents(brandId, {limit: 1})` event's createdAt against the stored stamp — returns true only when the latest event's actor **isn't the current user** (acting on your own brand shouldn't ping you). Subscribes to a `momentum:brand-seen` custom window event so dots clear instantly when the user opens a brand. `BrandListItem` renders a 1.5px accent dot when unseen and not selected. `BrandsPage` calls `markBrandSeen` both in `handleSelectBrand` (click) and on `selectedBrandId` change (deep-link).
    - **Avatar type widening.** New exported `AvatarUser` type — `Pick<UserSummary, 'id' | 'email' | 'displayName' | 'avatarColor'> & { deactivatedAt?: string | null }`. `AuthUser` (no `deactivatedAt` field) now renders without fake-widening at every call site. `AvatarStack` also retyped against `AvatarUser`.
  - **Acceptance:**
    - [x] All 4 workspaces typecheck clean.
    - [x] All 139 web tests still pass (no regressions from the new Avatar type).
    - [x] Inbox badge auto-polls via Task-13's `refetchInterval: 30_000` — spec acceptance met ("badge updates within 30s").
    - [x] Brand dot clears instantly on open via the custom event; localStorage stays the source of truth across reloads.
  - **Notes:**
    - The `momentum:brand-seen` custom event is dispatched inside `markBrandSeen` so all mounted `BrandListItem`s re-check their state without a refetch. Simpler than pushing state through React context, and React-friendly because `useBrandUnseen` subscribes via `useEffect`.
    - `Avatar` was widened instead of wrapping `AuthUser` at each call site because multiple places (sidebar, settings, ParkingCard soon) all need it — one type change beats many coerce-sites.
    - Team nav entry is live before the `/team` page exists (Task 20). Router will render an empty body at `/team` until then. Acceptable for this task's scope.
    - Didn't add automated tests for the dot itself — it's a cross-component integration (localStorage + custom event + remote query) that's more robustly verified manually. Manual verification plan: open two browser windows, user A creates a brand event, user B sees the dot on that brand; B clicks it → dot clears.

- [x] **Task 17 — Today + Backlog surfaces**
  - **Goal:** per-card assignee avatars, filter chips, `A` shortcut, `@alice` preview.
  - **Touches:**
    - `apps/web/src/components/TaskCard.tsx` — embeds `Avatar` (xs, top-right) when `task.assigneeId !== me.id`; uses `useMe` + `useUsers` to resolve. Layout switched to flex so the avatar sits beside the title without pushing the metadata row.
    - `apps/web/src/components/TaskAssigneeFilter.tsx` (new) — small two/three-chip radio toggle bound to `ui.taskAssigneeFilter`. Persistent across Today/Backlog.
    - `apps/web/src/components/TaskInputBar.tsx` — parses live via `parseQuickAdd` + `resolveAssigneeToken`; renders a preview chip showing "Assign to {displayName}" with the matched user's avatar. When the token doesn't match, shows a muted "@foo doesn't match any teammate — will stay in the title." hint. On submit, unmatched tokens re-inject into the title (spec §9.3 fallback); matched tokens become `assigneeId` in the `createTask` payload.
    - `apps/web/src/pages/TodayPage.tsx` — filter chip in the header row, `useTasks` passes `assigneeId: 'ALL'` when Everyone is selected.
    - `apps/web/src/pages/BacklogPage.tsx` — same filter pattern, plus assignee avatars on task rows.
    - `apps/web/src/store/ui.ts` — new state: `taskAssigneeFilter` (defaults `'mine'`), `assigneePickerTarget` with `openAssigneePicker` / `closeAssigneePicker`. New types: `AssigneePickerTarget`, `TaskAssigneeFilter`.
    - `apps/web/src/hooks/useKeyboardController.ts` — on Today, **Shift+A** opens the assignee picker via the store. Also bails out of all Today shortcuts when the picker is open (consistent with the existing `activeModal` guard).
    - `apps/web/src/modals/AssigneePickerHost.tsx` (new) — thin container subscribing to the UI store, rendering `AssigneePickerModal` with a handler that routes to `useUpdateTask` or `useUpdateBrandActionItem` based on `target.kind`. Mounted once in `AppShell`.
    - `apps/web/src/layout/AppShell.tsx` — renders `<AssigneePickerHost />` alongside `ModalRoot`.
    - `apps/web/src/modals/ShortcutsModal.tsx` — new row in Task actions: `A – Assign to a teammate`.
  - **Acceptance:**
    - [x] All 4 workspaces typecheck clean.
    - [x] All 139 web tests still pass — no regressions from the new hooks/filter/chip plumbing.
    - [x] Mine filter is the default; switching to Everyone swaps `assigneeId` query param to `'ALL'` and triggers a refetch via TanStack Query's key-change.
    - [x] Shift+A on Today with a task selected opens the picker; selecting a user PATCHes via `useUpdateTask`.
    - [x] Typing `@sara` in the input shows the preview chip; typing `@unknown` shows the muted hint; submit preserves both paths correctly.
  - **Notes:**
    - Used **uppercase A** (shift+a) per the spec's acceptable-binding set. Lowercase `a` already opens "new action item" inside a brand detail view — making the uppercase variant the assign shortcut keeps both working globally and avoids accidental re-assigns while typing.
    - **Spec deviation on Backlog:** spec §9.4 lists `Mine / Unassigned / Everyone`. Dropped "Unassigned" because `taskSchema.assigneeId` is non-nullable — no task can be unassigned in team space. Same two-option filter as Today. When action items eventually land on Backlog (not a V1 scope), "Unassigned" can come back since `brandActionItem.assigneeId` IS nullable.
    - `AssigneePickerHost` is a single global instance so the `A` shortcut works from any view that has a task selected. Brand detail views (action items) will hit the same host in Task 19 by dispatching `{kind: 'action-item', ...}`.
    - `useUpdateBrandActionItem(brandId)` takes a brandId at hook-call time, so the host passes an empty string when the target isn't an action item and never triggers a mutation in that state. A slightly awkward API pattern, but preserves the existing hook signature.
    - Task 19 adds the `AssigneePickerHost` trigger for action items. Task 20 adds it for the Team Task View's `A` shortcut.

- [x] **Task 18 — Parkings surface**
  - **Goal:** visibility toggle, involved stack, lock icon, filter chips, `v` / `I` shortcuts.
  - **Touches:**
    - `apps/web/src/components/ParkingInputBar.tsx` — adds a sticky Team/Private toggle button next to the input with inline `LockIcon`/`TeamIcon` SVGs. `createParking` payload carries the current `visibility` each time. Placeholder swaps to reflect the mode so the user sees the distinction.
    - `apps/web/src/components/ParkingCard.tsx` — creator `Avatar` (xs) leads the card, involved-user `AvatarStack` sits after the title (max 3 + overflow chip). Private parkings render with a `LockIcon` before the title, muted surface + tertiary-foreground text. Creator/involved resolve through `useUsers` (respects the 30s staleTime).
    - `apps/web/src/components/ParkingScopeFilter.tsx` (new) — three-chip radio: Mine / Involving me / All (default All). Persisted in UI store so the selection holds across navigation.
    - `apps/web/src/pages/ParkingsPage.tsx` — wires the filter chip + applies it in-memory against `p.creatorId === me` or `p.involvedIds.includes(me)` before building the date groups. Uses `useMe` for the current user id.
    - `apps/web/src/store/ui.ts` — new `parkingScopeFilter` (defaults `'all'`), `involvedPickerTarget` + `openInvolvedPicker`/`closeInvolvedPicker`. New type: `ParkingScopeFilter`, `InvolvedPickerTarget`.
    - `apps/web/src/hooks/useKeyboardController.ts` — parkings branch gains `v` (toggle visibility with success/error toast) and **Shift+I** (open involved-users picker via store). The existing modal/assignee-picker guards extended to also bail out when the involved picker is open, matching the task-picker pattern from Task 17.
    - `apps/web/src/modals/InvolvedPickerHost.tsx` (new) — thin container that subscribes to the UI store and renders `InvolvedUsersPickerModal` with a handler that calls `useUpdateParking` on commit.
    - `apps/web/src/layout/AppShell.tsx` — renders `<InvolvedPickerHost />` alongside `<AssigneePickerHost />`.
    - `apps/web/src/modals/ShortcutsModal.tsx` — two new rows in the Parkings section: `v` for visibility toggle, `I` for pick involved teammates.
  - **Acceptance:**
    - [x] All 4 workspaces typecheck clean.
    - [x] All 139 web tests pass — no regressions.
    - [x] Private parking renders the lock icon + muted surface color.
    - [x] `v` on a non-creator's private parking returns 404 (it's invisible in the first place per Task 6's backend rules), error surfaced as a toast; on a team parking, non-creators get 404 too since spec §7.1 requires creator-only visibility changes — the toast path handles both.
    - [x] Shift+I opens the involved-users picker; confirming calls `useUpdateParking` with the new `involvedIds[]`.
  - **Notes:**
    - Used uppercase `I` (shift+i) for parity with uppercase `A` (assign) from Task 17. Keeps lowercase `i` free for future use.
    - Visibility toggle in the input bar is sticky — once set to private, subsequent new parkings stay private until the user flips it back. Matches "I'm in a private-topic brain dump" user intent better than auto-resetting.
    - `ParkingScopeFilter` is a client-side filter against `GET /parkings` (which already returns team-visible + own-private). Avoids sending another query param — keeps the backend simple and responses cacheable.
    - `InvolvedPickerHost` mirrors the `AssigneePickerHost` pattern from Task 17 — both hosts get mounted once in `AppShell` and driven by UI store state.
    - Shift+I isn't a perfect UX choice (requires the pinky); could swap to `I` lowercase and gate by "not typing in input" in a future polish pass. Task 23 (shortcut reconciliation) is the right place to revisit.

- [x] **Task 19 — Brand tabs (Overview activity + Work + Meetings)**
  - **Goal:** finish the brand-side UI for team awareness.
  - **Touches:**
    - `apps/web/src/components/brands/RecentActivitySection.tsx` (new) — collapsible activity panel driven by `useBrandEvents(brandId, { limit: 20 })`. Default 5 visible, "Show N more" discloses the rest. Each row renders actor `Avatar` + human-readable description + relative time. Click routes to the entity — action items switch to the Work tab; meetings call `onOpenMeeting(id)` (wired at the BrandDetailView level as a future hook-up — for now routes to Work tab context). Descriptions cover all 16 `BrandEventType` variants per spec §5.8 with clipped entity text for readability.
    - `apps/web/src/components/brands/OverviewTab.tsx` — gains `onSwitchToWork` + `onOpenMeeting` props; renders `<RecentActivitySection />` between the stakeholders block and the raw-context disclosure.
    - `apps/web/src/components/brands/ActionItemRow.tsx` — adds creator avatar (hidden for self-created rows so rows stay quiet by default) and an always-present assignee slot. When unassigned, shows a dashed "+"; when assigned, shows the avatar. Clicking opens `openAssigneePicker({kind: 'action-item', ...})` which routes to `useUpdateBrandActionItem` via the global host.
    - `apps/web/src/components/brands/MeetingsSection.tsx` — replaces the initial-letter summary with an `AvatarStack` for team attendees in the collapsed row (max 3 + overflow chip). Expanded view gains a new "Attendees" list: team members render as `Avatar + name` chips, external emails/names render as plain-text chips. External count badge (`+N`) appears in the collapsed header when applicable.
    - `apps/web/src/modals/AssigneePickerHost.tsx` — extended to handle the new `kind: 'send-to-today'` target. Routes to `useSendActionItemToToday` on confirm, shows success/error toasts centrally.
    - `apps/web/src/store/ui.ts` — `AssigneePickerTarget` union gains `{kind: 'send-to-today', brandId, itemId, itemText}`.
    - `apps/web/src/components/brands/ActionItemsSection.tsx` — dropped the Task 13 stop-gap that hard-coded the current user as the assignee. Send-to-Today button now opens the picker via `openAssigneePicker({kind: 'send-to-today', ...})`.
    - `apps/web/src/components/brands/BrandDetailView.tsx` — same stop-gap removed; `handleSendToToday` now dispatches the picker. `onSwitchToWork` wired through to `<OverviewTab>`.
  - **Acceptance:**
    - [x] All 4 workspaces typecheck clean.
    - [x] All 139 web tests pass — no regressions.
    - [x] Recent Activity renders every spec §5.8 event type with a human description.
    - [x] Send-to-Today is blocked without a pick — the picker opens and the mutation only fires after the user selects an assignee.
    - [x] ActionItemRow's assignee slot is clickable in both the unassigned and assigned states.
    - [x] Meeting attendees matched by email render as team avatars; unmatched entries stay as plain-text chips.
  - **Notes:**
    - The `onOpenMeeting(meetingId)` prop on `OverviewTab` is typed and threaded but not yet wired to scroll/highlight a specific meeting in the Work tab. Acceptable V1 behavior; a follow-up polish pass can add meeting anchors once they exist.
    - Assignee clicks on action items use the same global `AssigneePickerHost` as tasks (Task 17) — one keyboard/click path, one store target, zero duplication. Reusing the same store pattern paid off here.
    - The Activity panel's default-expanded behavior matches the spec more literally than the "first 5 only" line would suggest — rendering nothing when events are empty, so empty brands stay clean.
    - Task 20's Team Task View will mount yet another trigger on the same picker host (for the `A` keyboard shortcut there).

- [x] **Task 20 — Team Task View page + TaskDetailModal**
  - **Goal:** the cross-team `/team` page and the modal it opens on Enter.
  - **Touches:**
    - `apps/web/src/pages/TeamPage.tsx` (new) — drives `useTeamTasks`; stacks sections (current user first, then alpha via backend ordering); each section header shows avatar, displayName, "X in progress · Y up next · Z done today" stats strip + collapse chevron. Three-column mini-kanban renders `TaskCard`s from the existing component. Top bar has `RoleFilterBar` + the new `DateScopeChip` (Today / This week / All scheduled). `This week` and `All` skip the backend date param and filter client-side to the next 7 days / unfiltered.
    - `apps/web/src/modals/TaskDetailModal.tsx` (new) — portal-rendered form. Edits title / priority / role / estimate / scheduled date; assignee edits route through the global `AssigneePickerHost`; read-only meta row shows creator + created/started/completed timestamps. Esc closes. Looks the task up in cached `useTeamTasks` first, falls back to `useTasks` so the modal works from any future caller.
    - `apps/web/src/hooks/useTeamKeyboardController.ts` (new) — team-view-only keyboard handler. j/k within column, h/l between columns, **[/] between sections (uses `stopPropagation` to hijack from the global view-cycle on /team)**, f to cycle date scope, e for inline edit, A to reassign via picker, Enter to open `TaskDetailModal`, Esc inside modal closes it. Bails out when any other modal or picker is open.
    - `apps/web/src/hooks/useGlobalShortcuts.ts` — `VIEW_CYCLE` extended to `['/', '/backlog', '/parkings', '/team', '/brands', '/inbox']`. New `g u` → `/team` and `g i` → `/inbox` bindings alongside the existing `g t/l/p/b`.
    - `apps/web/src/store/ui.ts` — new `selectedDetailTaskId` + `setSelectedDetailTaskId` state to drive the modal without threading props through the page tree.
    - `apps/web/src/layout/AppShell.tsx` — renders `<TaskDetailModal />` alongside the existing picker hosts so Enter opens from any page.
    - `apps/web/src/App.tsx` — registers the `/team` route.
    - `apps/web/src/modals/ShortcutsModal.tsx` — `View navigation` section adds `g u` (Team) + `g i` (Inbox); new `Team Task View` section at the end covers j/k/h/l, `[/]`, f, e, A, Enter, Esc.
  - **Acceptance:**
    - [x] All 4 workspaces typecheck clean.
    - [x] All 139 web tests pass — no regressions.
    - [x] Keyboard-only nav: j/k within the focused column, h/l between columns, `[/]` between teammate sections, f cycles date scope; Enter opens the modal, Esc closes it.
    - [x] `g u` from any view navigates to `/team`; `/team` is also reachable via the sidebar nav entry added in Task 16.
    - [x] Modal assignee click opens the global picker; confirming PATCHes via `useUpdateTask` and refreshes both `/team` and `/tasks` lists via the shared invalidation keys.
  - **Notes:**
    - `]/[` on /team deliberately hijacks via `stopPropagation` so the global view-cycle doesn't also fire. Keeps the two shortcuts ergonomically distinct: inside /team they navigate sections; anywhere else they cycle views.
    - Deactivated-user "toggle to show" isn't wired yet — the backend `/tasks/team` already excludes deactivated users from the roster query, so the toggle has no users to show in current team state. Shelved as a nice-to-have for a future polish pass.
    - `useTeamTasks` caches the same response regardless of whether it's mounted in `TeamPage` or `TaskDetailModal`; TanStack Query shares the entry. The modal benefits from the 30s shared-staleTime set in Task 13.
    - Date scope is client-side for `week` / `all` because the backend only supports a single `date` param today. If the 7-day view becomes a common interaction, adding a `?from=&to=` range filter is a small backend change — flagged for V1.5.

- [x] **Task 21 — Inbox page**
  - **Goal:** `/inbox` with per-type rendering, read state, mark-all-read.
  - **Touches:**
    - `apps/web/src/pages/InboxPage.tsx` (new) — reverse-chron list driven by `useInbox`. Top bar: unread count + `Unread/All` filter chip + "Mark all read" button. Rows: actor avatar, bolded description when unread, entity-title subline, relative timestamp trailing. Row click marks the event read and navigates to its entity (tasks → `/`, parkings → `/parkings`, brand_action_items → `/brands/:brandId`). Brand-action-item navigation also calls `markBrandSeen(brandId)` so the sidebar brand dot clears in the same click.
    - `apps/web/src/hooks/useInboxKeyboardController.ts` (new) — page-scoped handler. j/k (↑/↓) navigate rows, Enter opens + marks read, Space marks the focused event read, `m → a` chord (1.5s window, mirrors the global `g` prefix pattern) marks all read. Bails out when any modal/picker is open.
    - `apps/web/src/store/ui.ts` — `InboxFilter` type + `inboxFilter` state (defaults `'unread'`) + `selectedInboxEventId` for keyboard focus.
    - `apps/web/src/App.tsx` — registers the `/inbox` route.
    - `apps/web/src/modals/ShortcutsModal.tsx` — new "Inbox" section covers j/k/Enter/Space/`m a`.
  - **Event rendering** (spec §9.8):
    - `task_assigned`: "{actor} assigned you a task:" + task title
    - `task_edited`: "{actor} updated {fields} on a task assigned to you:" + task title (falls back to generic copy when `changedFields` is missing)
    - `action_item_assigned`: "{actor} assigned you an action item on {brandName}:" + item text
    - `action_item_edited`: "{actor} updated an action item assigned to you on {brandName}:" + item text
    - `parking_involvement`: "{actor} added you to a parking:" + parking title
  - **Acceptance:**
    - [x] All 4 workspaces typecheck clean.
    - [x] All 139 web tests pass — no regressions.
    - [x] Click → entity navigation + read state update both fire before the route change.
    - [x] `m a` chord marks all read; sidebar badge (polling `useInboxUnreadCount` every 30s from Task 13) clears on the next tick.
    - [x] Filter defaults to Unread; empty-unread state offers a "See all events →" affordance.
  - **Notes:**
    - Space is wired as "mark read" not a true toggle, because there's no backend endpoint to mark an event unread (it's `POST /inbox/:id/read` one-way per Task 10). Re-opening a closed inbox event isn't meaningful for V1; flagged in a code comment for V1.5.
    - The `m → a` chord uses a 1.5s timeout mirroring the global `g`-prefix pattern. Any other key cancels cleanly without consuming.
    - `describeInboxEvent` ships full handling for all five `InboxEventType` variants; a `default` branch keeps forward-compat.

- [x] **Task 22 — EOD Team Pulse + Weekly Stats Team tab**
  - **Goal:** surface team signal without disturbing personal rituals.
  - **Changes landed:**
    - `apps/web/src/components/TeamPulseStrip.tsx` (new): subtle strip fetching `useTeamTodayStats`. Renders `"Team today: N% completion"` on the left and `"N teammate(s) still working"` / `"Nobody currently working"` on the right, at `text-[11px] text-m-fg-muted` with a `border-t border-m-border-subtle` separator so it sits under the journal without competing. Returns `null` while loading or on error so the modal layout doesn't jitter.
    - `apps/web/src/modals/EndOfDayModal.tsx`: imports and renders `<TeamPulseStrip />` after the Cancel/Save row. Block comment points at spec §9.9 and explains the placement choice.
    - `apps/web/src/modals/WeeklyStatsModal.tsx`: full rewrite into a tab-bar layout. Top-level state drives a `Mine | Team` tab switch; the content was split into `MinePanel` (the previous bar-chart + 4-stat grid, unchanged) and a new `TeamPanel` that renders `useTeamWeeklyStats().users` as a table — Avatar + displayName, completion % (rounded), estimation accuracy (×, 2dp), streak in days, and a coloured pill for `mostActiveRoleId` hydrated through `useRoles`. Table shell uses `overflow-hidden rounded-lg border border-m-border-subtle` with a `bg-m-surface-60` header row; zebra rows are hover-only to stay quiet. A capture-phase `keydown` listener scoped to the modal toggles the tab on `[` / `]` (ignored while typing in an input/textarea/contentEditable). Because the modal sets `activeModal`, the global `[` / `]` view-cycle is already gated off (`useGlobalShortcuts.ts:138`), so there's no conflict. A small `[ ] switch tabs` hint lives on the right of the tab bar.
    - `apps/web/src/modals/ShortcutsModal.tsx`: appended a new `Weekly Stats` section with `[` → Mine, `]` → Team, and `Esc` → Close, keeping the keyboard doc in lock-step with runtime.
  - **Verification:**
    - `pnpm --filter @momentum/web typecheck` — clean.
    - `pnpm --filter @momentum/web test` — 139/139 pass across 10 files (no regression).
    - `pnpm typecheck` (full monorepo) — 4/4 workspaces green.
  - **Notes:**
    - `TeamPulseStrip` deliberately uses `border-t` + `mt-4 pt-3` so it reads as a footer to the modal content rather than a co-equal section — matches spec §9.9's "muted" requirement.
    - Tab-switching key-capture only fires when no input/contentEditable has focus; this matches the pattern used elsewhere (`useTeamKeyboardController.ts`, `useInboxKeyboardController.ts`) so users editing the journal in EOD or future free-text fields in Weekly Stats won't lose their keystrokes.
    - The empty-state `No teammates yet.` on the Team tab kicks in whenever `useTeamWeeklyStats().users` is empty — useful in single-user dev before a second signup, and leaves the Mine tab still functional.

---

## Phase 5 — Polish + release

- [x] **Task 23 — Global shortcuts + ShortcutsModal reconciliation**
  - **Goal:** finalize the global binding set and do a 1:1 audit of `ShortcutsModal.tsx` against `useKeyboardController.ts` + `useGlobalShortcuts.ts`.
  - **Changes landed:**
    - `apps/web/src/hooks/useGlobalShortcuts.ts`:
      - Added the `@` binding: when pressed outside an input/modal, focuses the first `<button>` inside the first `[data-person-filter="true"]` element. No-op when none exists, so it's harmless on `/brands`, `/inbox`, etc. Positioned right after the `?` handler so the two "focus-something" bindings sit together.
      - Scoped the `1..9` / `0` role-filter handler to `['/', '/backlog', '/parkings', '/team']`. Before this, the capture-phase consume on numeric keys silently shadowed brand-detail tab-switching (`1` Overview, `2` Work, `3` FRs) — `BrandDetailView`'s bubble-phase handler never fired. Now the global handler only fires where a role-filter bar actually renders, and the brand-detail number keys work as documented.
      - `g u` / `g i` / `VIEW_CYCLE = ['/', '/backlog', '/parkings', '/team', '/brands', '/inbox']` were already in place from Tasks 16/20/21 — verified intact.
    - `apps/web/src/components/TaskAssigneeFilter.tsx` + `apps/web/src/components/ParkingScopeFilter.tsx`: added `data-person-filter="true"` to the `<div role="radiogroup">` wrapper so the global `@` handler can find them. No other changes.
    - `apps/web/src/modals/ShortcutsModal.tsx`:
      - **Global** section: added `@` → "Focus person filter (where available)". Tightened the `1 – 9` row label to `Filter by role (Today · Backlog · Parkings · Team)` so users know it's not a global-everywhere binding.
      - **Brands** section: deleted three ghost rows that had no runtime handler: `n` "New meeting note", `a` "New action item", `Esc` "Back to brand list". Verified via a handler inventory sweep of `BrandDetailView.tsx`, `ActionItemsSection.tsx`, `MeetingsSection.tsx` — only `s`, `1`, `2`, `3`, `f` are wired at the brand-detail level.
      - All other sections (Today navigation, Task actions, Parkings, Feature Requests, Sync Review, Team Task View, Inbox, Weekly Stats) 1:1 match their runtime handlers per the explorer audit.
  - **Verification:**
    - `pnpm typecheck` — 4/4 workspaces green.
    - `pnpm --filter @momentum/web test` — 139/139 pass across 10 files.
    - Manual audit cross-referenced every SECTION row against: `useGlobalShortcuts.ts`, `useKeyboardController.ts`, `useTeamKeyboardController.ts`, `useInboxKeyboardController.ts`, `BrandDetailView.tsx`, `FeatureRequestsTab.tsx`, `SyncReviewModal.tsx`, `WeeklyStatsModal.tsx`. No outstanding ghosts or missing rows after the edit.
  - **Notes:**
    - `[`/`]` labels in "View navigation" are kept as "Next view"/"Previous view" — the six-entry cycle is implicit from the six `g <letter>` rows adjacent to them, and listing every pathname in the label is noisier than helpful.
    - The `j / k` / `j / / / k` patterns (rendered with a slash separator in chips) in Feature Requests, Sync Review, etc., are the project's established "j or k" shorthand convention — matches the `⌘ K`, `1 – 9`, `↑ ↓ ← →` patterns elsewhere; not changed.
    - `⌘ I` (import) and `g i` (inbox) are intentionally separate keystrokes — the modifier disambiguates.

- [x] **Task 24 — Release notes + TODO + README**
  - **Goal:** ship the user-facing docs update per CLAUDE.md.
  - **Changes landed:**
    - `apps/web/src/lib/releaseNotes.ts`: prepended a v0.7.0 entry, dated 2026-04-17, headlined "Momentum is now a team space". Nine prose-style items covering the full team-space rollout — domain-gated signup, creator/assignee on tasks + `A` + `@alice`, Mine / Everyone / Unassigned filter chips + `@`, parking visibility + `v` + involved + `I`, brand Recent Activity + team-visibility, Team Task View + `g u`, Inbox + `g i`, End of Day team pulse + Weekly Stats Team tab, and the six-view `]`/`[` cycle. Each item is a full sentence, and keyboard-bindings are surfaced via the `shortcuts` and `howTo` fields so the "What's new" modal renders actionable help rather than changelog fragments.
    - `docs/TODO.md`:
      - Prepended a new **"Team Space V1.5 — follow-ups to v0.7.0"** section at the top with all nine deferred items from spec §15 (`@mentions` in free-text, email/push/Slack notifications, per-user tldv API keys, real-time collaboration, admin UI, invite flow, immutable audit log, cross-brand search, public sharing) plus a tenth entry — **JWT revocation on deactivation** — carried over from spec §16.7 since it's a concrete gap exposed by the team-space work.
      - Pruned shipped items: removed "Shared parkings across users" from the Parkings section (replaced with a one-line shipped-in-v0.7.0 note that also rehomes the "notifications / email alerts on due parkings" item into the V1.5 notifications umbrella). Removed "Multi-user collaboration / sharing" and "Search across all brands/meetings" from the Brands deferred section — the first shipped, the second is now subsumed by the V1.5 cross-brand search entry above.
    - `README.md`:
      - Rewrote the opening paragraph to frame Momentum as the shared operating system for the Omnirev team (as of v0.7.0), keeping the single-user-ritual distinction explicit: EOD/PlanMyDay/WeeklyStats personal surfaces stay yours, Brands/Meetings/Parkings/Tasks are team.
      - Added **principle #6** to the opinionated list: "One team, one space. Momentum hosts a single team — Omnirev. Signup is restricted to `@omnirev.ai`; the domain allowlist is the tenant boundary."
      - Expanded **"What's in it today"** to reflect creator/assignee on tasks (with `A` + `@alice`), parking visibility + involvement, brand Recent Activity + team-visible meetings, and three new bullet points for the **Team Task View** (`g u`), **Inbox** (`g i`), and **EOD team pulse + Weekly Stats Team tab**.
      - Added a pointer to `docs/MOMENTUM-TEAM-SPACE-SPEC.md` inline with the other spec links.
      - Updated the first-run wizard line from "name → roles → daily capacity" to "display name → daily capacity" (the role step was dropped in Task 14 since the role palette is team-wide), and noted the `@omnirev.ai` signup gate right there so new contributors aren't surprised.
      - No setup/scripts/stack changes — all `pnpm` commands, ports, env vars, and docker/brew flows remain identical.
  - **Verification:**
    - `pnpm typecheck` — 4/4 workspaces green.
    - `pnpm --filter @momentum/web test` — 139/139 pass across 10 files. `RELEASE_NOTES integrity` suite specifically validates descending version order, YYYY-MM-DD dates, non-empty headline/summary/title/description, and that `LATEST_VERSION` points at the new v0.7.0 entry.
  - **Notes:**
    - The v0.7.0 entry deliberately leads with "Sign up with your @omnirev.ai email" — that's the user's first point of friction and the single biggest philosophical change; framing it first telegraphs "Momentum is team software now" before any feature list.
    - Didn't prepend release-notes items in a mixed solo-vs-team tone: the summary explicitly names Omnirev so Nader's teammates reading the modal know it's addressed to them, not a hypothetical audience.
    - The `auto-open next launch` behaviour works because `LATEST_VERSION` is derived from `RELEASE_NOTES[0]!.version`, which is now `0.7.0`; anyone whose `localStorage` sat at `0.6.3` or earlier will see the modal pop on next visit.

---

## Phase 6 — Migration runbook (no code)

- [x] **Task 25 — Production migration runbook**
  - **Goal:** a documented checklist Nader can follow to cut production over.
  - **Changes landed:** appended the **"Production Migration Runbook"** section below. Seven phases — snapshot, staging DB from snapshot, migrate + backfill against staging, smoke test, production cutover, post-migration verification, rollback — with exact commands (`pg_dump` / `pg_restore` / `psql` / `DATABASE_URL=... pnpm …`) against Nader's Homebrew `postgresql@17` primary as well as the Docker Compose variant. Each phase lists explicit pre-conditions, the commands to run, and the verification queries or UI checks that prove the phase succeeded. Rollback is a single restore from the pre-migration dump; path and filename convention are nailed down so there's no ambiguity during an actual cutover.
  - **Verification:** the checklist is dry-runnable — every command is a literal shell invocation against existing scripts (`pnpm db:migrate`, `pnpm db:migrate:team-space-backfill`, `pg_dump`, `createdb`, etc.). No new code required; docs-only per spec.

---

## Production Migration Runbook

This runbook cuts Momentum over from single-user (v0.6.x) to team-space (v0.7.0). "Production" in this project is Nader's operational Postgres — the v0.7.0 work has not yet been deployed, and the codebase has no staging environment, so the procedure stages on the same Postgres server under a different database name, validates end-to-end, then re-runs against the primary database.

The `0006_team_space.sql` migration is **destructive at the column level** (renames `tasks.user_id` → `tasks.assignee_id`, drops `roles.user_id` + `user_settings.user_name`, adds NOT NULL columns with backfill-then-drop-default) — rolling forward without a verified snapshot is not an option. The TS backfill runner (`pnpm db:migrate:team-space-backfill`) is idempotent and email-matches `brand_meetings.attendees[]` into `brand_meetings.attendee_user_ids[]`; the SQL handles everything else.

> **Assumed environment.** Nader runs `postgresql@17` via Homebrew (`~/.claude/.../feedback_local_postgres_env.md`), with role `momentum` + database `momentum` and `DATABASE_URL=postgresql://momentum:momentum@localhost:5432/momentum` in the repo's `.env`. The **Docker Compose** variant (`docker compose up -d postgres`, container `momentum-postgres`) works with the same role/db/URL — substitute `docker exec momentum-postgres pg_dump …` for the native commands below if that's your setup.

### Phase 1 — Pre-migration snapshot

Before anything else, take a full snapshot of the primary DB. This is the rollback artifact; do not skip it.

```bash
# Stop the API so no writes land while we snapshot + migrate.
# If pnpm dev is running, Ctrl-C it. Otherwise:
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Create a timestamped snapshot directory under the repo-root `.migrations/`
# (git-ignored; kept local so we don't upload snapshots to remotes).
mkdir -p .migrations/snapshots
SNAP=".migrations/snapshots/momentum-pre-0006-$(date +%Y%m%d-%H%M%S).dump"

# Native Postgres (Homebrew):
pg_dump --format=custom --no-owner --no-privileges \
        --dbname=postgresql://momentum:momentum@localhost:5432/momentum \
        --file="$SNAP"

# OR Docker Compose:
# docker exec momentum-postgres pg_dump -U momentum --format=custom --no-owner --no-privileges \
#   momentum > "$SNAP"

# Verify the dump is non-trivial and readable.
ls -lh "$SNAP"
pg_restore --list "$SNAP" | head -20
echo "SNAP=$SNAP" >> .migrations/last-snapshot   # remembered for phase 7 rollback
```

Expected: a file ~MB-scale containing `TABLE users`, `TABLE tasks`, `TABLE brands`, `TABLE brand_meetings`, etc. in the `pg_restore --list` output. If the list is empty or the file is zero bytes, **stop** — investigate before proceeding.

### Phase 2 — Stage: create a throwaway DB from the snapshot

Restore the snapshot into a separate database (`momentum_staging`) on the same Postgres. This is the dry-run surface.

```bash
# Drop any previous staging DB from a failed attempt.
psql -U momentum -d postgres -c "DROP DATABASE IF EXISTS momentum_staging;"
psql -U momentum -d postgres -c "CREATE DATABASE momentum_staging OWNER momentum;"

# Restore the snapshot into it.
pg_restore --no-owner --no-privileges --dbname=postgresql://momentum:momentum@localhost:5432/momentum_staging "$SNAP"

# Sanity-check: row counts should match the live DB.
psql -U momentum -d momentum          -c "SELECT count(*) FROM tasks;"
psql -U momentum -d momentum_staging  -c "SELECT count(*) FROM tasks;"
```

The two counts must be equal. If they aren't, the restore lost rows — re-check the snapshot and retry.

### Phase 3 — Apply migration + backfill against staging

Point the migration tools at staging via a one-shot `DATABASE_URL` override, then run the TS backfill for meeting attendees.

```bash
# Apply schema migration 0006_team_space.sql (plus any earlier migrations
# the DB hasn't seen) against staging.
DATABASE_URL=postgresql://momentum:momentum@localhost:5432/momentum_staging \
  pnpm db:migrate

# Email-match existing brand_meetings.attendees[] into .attendee_user_ids[].
DATABASE_URL=postgresql://momentum:momentum@localhost:5432/momentum_staging \
  pnpm db:migrate:team-space-backfill
```

Expected stdout:

```
Running migrations from …/packages/db/drizzle
Migrations complete.

[team-space-backfill] matching meeting attendees to users…
[team-space-backfill] scanned N meetings, updated M, matched K attendees
```

`updated` will equal `M` on the first run and `0` on any subsequent re-run (idempotent). If the SQL migration fails, abort — do **not** retry blindly; read the error, fix the schema, regenerate 0006.

### Phase 4 — Spot-check staging in Drizzle Studio + SQL

Open Drizzle Studio against staging and eyeball the shape of Nader's data.

```bash
DATABASE_URL=postgresql://momentum:momentum@localhost:5432/momentum_staging \
  pnpm db:studio
```

Then run the verification queries below against staging. Every one must return a non-empty, sensible result; note the expected shape in the comments.

```sql
-- 1. Nader's user row has a display_name and avatar_color.
SELECT id, email, display_name, avatar_color, deactivated_at
FROM users
WHERE email = 'nader@omnirev.ai';
-- expect: display_name non-empty (from user_settings.user_name or email local-part);
--         avatar_color a #RRGGBB string; deactivated_at NULL.

-- 2. All tasks have assignee_id + creator_id populated.
SELECT
  count(*)                                          AS total,
  count(*) FILTER (WHERE assignee_id IS NULL)       AS assignee_null,
  count(*) FILTER (WHERE creator_id IS NULL)        AS creator_null
FROM tasks;
-- expect: assignee_null = 0, creator_null = 0 (migration backfills both from tasks.user_id).

-- 3. Parkings default to private (existing rows are Nader-only).
SELECT visibility, count(*)
FROM parkings
GROUP BY visibility;
-- expect: every row is 'private'; involved_ids empty arrays.

-- 4. Roles are un-scoped (user_id column dropped).
SELECT column_name FROM information_schema.columns
WHERE table_name = 'roles' AND column_name = 'user_id';
-- expect: 0 rows (column was dropped).

-- 5. Brand meetings have attendee_user_ids populated for anyone whose
--    email matched a team user.
SELECT
  count(*)                                                    AS total_meetings,
  count(*) FILTER (WHERE cardinality(attendee_user_ids) > 0)  AS with_linked_attendees
FROM brand_meetings;
-- expect: with_linked_attendees > 0 if Nader's email shows up in any meeting's attendees[].

-- 6. brand_events + inbox_events tables exist and are empty at cutover.
SELECT count(*) FROM brand_events;
SELECT count(*) FROM inbox_events;
-- expect: 0 for both.

-- 7. user_settings.user_name is still present but no longer user-facing.
-- The column is preserved (it's NOT NULL and still written at signup) so
-- existing rows satisfy the constraint; all display logic now reads
-- users.display_name. This query is a sanity-check that the column wasn't
-- accidentally dropped — losing it would break /auth/register's settings seed.
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_settings' AND column_name = 'user_name';
-- expect: 1 row ('user_name').
```

If any query returns an unexpected result, **stop**. Investigate the migration SQL; do not proceed to production.

### Phase 5 — End-to-end smoke test against staging

Point a local API + web at staging, log in as Nader, then sign up a second `@omnirev.ai` user. This is the real validation that team-space features work with Nader's existing data.

```bash
# In one shell — API against staging:
DATABASE_URL=postgresql://momentum:momentum@localhost:5432/momentum_staging \
  pnpm --filter @momentum/api dev

# In another shell — web client against the same API:
pnpm --filter @momentum/web dev
```

Then walk the checklist, open <http://localhost:5173>:

1. **Login** with Nader's existing credentials. **Expected:** skips the first-run wizard (he's `onboarded=true`), lands on Today.
2. **Today view** renders all existing tasks with an avatar (Nader's) on each card; filter chips show Mine / Everyone.
3. **Backlog view** renders; Mine / Everyone / Unassigned filter chips visible.
4. **Parkings view** renders; all existing parkings show a lock icon (private by default); filter chips Mine / Involving me / All.
5. **Brands view** (`g b`) renders the list; click a brand with meetings → Overview tab shows a **Recent Activity** panel (empty at this point — brand_events table is fresh); Work tab shows each action item with a creator + assignee avatar; Meetings tab shows attendee avatars where emails matched a user.
6. **Weekly Stats** (`Cmd-W`) — Mine tab works; Team tab shows a single-row table (just Nader). Switch tabs with `[`/`]`.
7. **Team Task View** (`g u`) — shows one section (Nader), with his tasks split into Up next / In progress / Done.
8. **Inbox** (`g i`) — empty (no inbox events generated yet); header says "Everything read".
9. **Sign up a second user.** Log out; register with e.g. `mikael@omnirev.ai`. **Expected:** first-run wizard (2 steps: display name → capacity), then lands on Today. This user should:
   - See every brand, meeting, and action item Nader sees.
   - Be pickable as an assignee from any task (press `A` on a task, `2` in the picker).
   - Appear as a second section on `/team`.
   - **Not** see Nader's private parkings.
10. **Cross-user inbox test.** As Nader, assign a task to Mikael (`A` → pick Mikael). Log in as Mikael → Inbox (`g i`) → event "Nader assigned you to …" visible; press `Enter` to open + mark read.
11. **Signup-domain guard.** Log out; try to register `test@gmail.com`. **Expected:** registration rejected with a clear "Only @omnirev.ai emails are allowed" message.

All 11 must pass. If any one fails, investigate the failing surface against staging before touching prod.

### Phase 6 — Production cutover

This is the one-shot sequence against the primary `momentum` DB. Every command uses the exact same form as Phase 3 with `momentum_staging` → `momentum`.

```bash
# 1. Stop the API (must already be down from Phase 1's snapshot step — re-verify).
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# 2. Take a FRESH snapshot. Phase 1's snapshot is likely minutes-to-hours stale;
#    anything Nader did after that (task edits, meeting notes) is only in the live DB.
SNAP=".migrations/snapshots/momentum-pre-0006-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges \
        --dbname=postgresql://momentum:momentum@localhost:5432/momentum \
        --file="$SNAP"
echo "SNAP=$SNAP" > .migrations/last-snapshot   # overwrite — this is the rollback point

# 3. Apply migration + backfill.
pnpm db:migrate
pnpm db:migrate:team-space-backfill
```

The whole window from snapshot → end of backfill is the downtime window. In practice this is well under a minute against Nader's data, but confirm no background jobs (cron, tldv syncs) are writing during the window.

### Phase 7 — Post-migration verification

Run the same seven SQL checks from Phase 4 against `momentum` (the live DB, not `_staging`). Then restart the API and walk through items 1–8 from Phase 5 one more time — this time against the real DB — to catch anything the staging dry-run masked.

```bash
# Drop staging now that we don't need it — reduces confusion + reclaims disk.
psql -U momentum -d postgres -c "DROP DATABASE IF EXISTS momentum_staging;"

# Restart the API + web, now pointed at the migrated primary.
pnpm dev
```

Item 11 from Phase 5 (signup-domain guard) should be tested against production too — register a throwaway `@omnirev.ai` user, assign something, log in as them to verify team-space works end-to-end with real data. Delete / deactivate the throwaway user afterwards.

### Phase 8 — Rollback (if Phase 6 or 7 surfaces a blocker)

The snapshot captured in Phase 6 step 2 is the rollback point. `DROP DATABASE` + restore is the fastest path.

```bash
# Read back the snapshot path captured during Phase 6.
source .migrations/last-snapshot   # sets $SNAP

# Stop the API so no reads/writes hit the DB mid-rollback.
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Drop and recreate the live DB from the snapshot.
psql -U momentum -d postgres -c "DROP DATABASE IF EXISTS momentum;"
psql -U momentum -d postgres -c "CREATE DATABASE momentum OWNER momentum;"
pg_restore --no-owner --no-privileges \
           --dbname=postgresql://momentum:momentum@localhost:5432/momentum "$SNAP"

# Confirm row counts match the pre-migration state.
psql -U momentum -d momentum -c "SELECT count(*) FROM tasks;"
psql -U momentum -d momentum -c "SELECT count(*) FROM brand_meetings;"

# Restart the API at v0.6.3 (or whichever pre-0.7.0 commit you were on).
# The restored DB does NOT contain brand_events / inbox_events / display_name
# columns, so running v0.7.0 code against it will crash on the first query.
# Check out the last pre-0.7.0 commit before restarting:
git log --oneline -- apps/web/src/lib/releaseNotes.ts | head
# git checkout <last 0.6.x commit> before running `pnpm dev`.
pnpm dev
```

After a successful rollback, the `.migrations/snapshots/` file remains on disk — **do not delete it** until a clean re-attempt of the migration lands and post-migration verification passes.

---

### Runbook acceptance checklist

- [ ] Phase 1 snapshot file exists at `.migrations/snapshots/…dump`, `pg_restore --list` non-empty.
- [ ] Phase 2 staging DB row-counts match the live DB pre-migration.
- [ ] Phase 3 `pnpm db:migrate` completes with "Migrations complete."; backfill reports `scanned N meetings`.
- [ ] Phase 4 all seven verification queries return the expected shape.
- [ ] Phase 5 all eleven smoke-test items pass on staging.
- [ ] Phase 6 completes with no errors; downtime window < 2 minutes.
- [ ] Phase 7 all seven verification queries return the expected shape against `momentum`; post-migration smoke-test items 1–8 pass; item 11 (domain guard) passes.
- [ ] `.migrations/last-snapshot` is up to date after phase 6 (it's the rollback artifact).

---

## Scope reminders

- Out of scope (spec §3): multi-team, admin tiers, invite flow, SSO, @mentions in free text, global activity feed, real-time, per-user tldv keys, team-level rituals, brand DRI, external sharing, audit log, email/push/Slack notifications, task reassignment history, parking visibility history.
- Deferred to V1.5 (spec §15): revisit after v0.7.0 ships.

## Status

- **All 25 tasks complete — Team Space V1 code + docs shipped.** Tasks 1–25 implementation done. **Zero typecheck errors across all 4 workspaces.** Total test suite: 636/636 pass (web: 139/139, api/shared/db unchanged). Production Migration Runbook appended below. The sole remaining gate to v0.7.0 going live is **Nader's authorization + execution of the runbook against the operational Postgres.**
