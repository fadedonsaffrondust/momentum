# Momentum — Team Space V1 Feature Spec

> The V1 upgrade from single-user Momentum to a single-team operating system for Omnirev. This is the authoritative design document for Claude Code to execute against.
>
> **Version:** 1.0
> **Date:** 2026-04-17
> **Target release:** Momentum v0.7.0
> **Companion docs:** `MOMENTUM-PROJECT-CONTEXT.md`, `MOMENTUM-TECHNICAL-SPEC.md`, `MOMENTUM-TEAM-SPACE-RESEARCH.md` (design rationale).
>
> **Hard constraint:** Momentum will only ever host ONE team (Omnirev). There is no second tenant, now or ever. This shapes every architectural simplification below.

---

## 1. Workflow Moments

Every feature in this spec earns its place because it shows up in one of these daily moments. If you can't trace a feature back to a workflow moment, it shouldn't be here.

**Monday 8:00 am — Nader plans his day.** He opens Momentum, hits `⌘P` for Plan My Day, and sees that Sara assigned him two new tasks over the weekend: review the Boudin proposal draft, prep for Cowboy Chicken QBR. He pulls both into Today. He also notices the sidebar Inbox badge — three unread items: the two assignments plus Ryan bumping the priority on a task Nader created yesterday. He clears inbox, now at zero.

**Tuesday 10:15 am — Sara finishes a Boudin call.** She opens the Boudin brand page, creates a meeting note, and writes action items. Two of them need engineering work — she clicks "Send to Today" on both, picks Nader in the person picker for one and Ryan for the other. Nader and Ryan each get the items in their inbox and on their Today queue. Sara sees her brand action items drop out of the "open" list because they now show as linked to active tasks.

**Wednesday 9:45 am — Team standup.** Nader opens the Parkings page. He sees: four shared parkings scheduled for today (one he raised, two from Sara, one from Ryan), plus two private parkings only he can see (lock icon, muted styling). Sara's parking is titled "Pipeline review — need a decision from Nader" with Nader tagged in `involved_ids[]`. The team walks through each shared parking; Nader's private ones never come up.

**Thursday afternoon — Cross-team view.** Nader wants to know "where is everyone right now?" He hits `g u` and lands on the Team Task View. He sees a section per team member showing their Up Next / In Progress / Done for today. Ryan has five tasks Up Next but nothing In Progress — he's probably in calls. Sara has three In Progress — she's heads-down shipping. That's enough information to know who to ping vs. who to leave alone.

**Friday 5:30 pm — End of day.** Nader runs `⌘R` for End of Day Review. His journal entry is private (nobody else sees what he writes), but the team pulse strip at the bottom shows the team finished 82% of planned tasks today and two teammates still have tasks In Progress. He wraps up, logs a short reflection, closes the laptop.

**Monday morning (new hire) — Ryan signs up.** Ryan joined Omnirev last week; it's his first day using Momentum. He goes to the signup page, enters `ryan@omnirev.ai`. Signup succeeds (the `@omnirev.ai` allowlist matches). He lands on a first-run wizard — two steps only: display name + daily capacity. Roles are already there (team-defined). He hits finish; his avatar is auto-generated. He opens the Brands page — all ten brands load immediately. He opens Cowboy Chicken and sees the entire meeting history Sara and Nader have built up over six months. Nothing to copy over, nothing to onboard.

---

## 2. V1 Done Criteria

V1 ships when all of the below are true. If any item is incomplete, V1 is not done.

1. A non-@omnirev.ai email cannot sign up; the signup page rejects with a clear message.
2. An @omnirev.ai email successfully signs up, lands on a first-run wizard (name + capacity only; no role creation), and has immediate read access to all existing brands and their sub-entities.
3. Every task has a creator and an assignee; the UI shows both avatars on task cards.
4. Tasks can be assigned via the `A` keyboard shortcut (opens a person picker) or via the `@alice` quick-add modifier in the task input bar.
5. Any team member can edit any task, parking, or brand entity (flat permission model). Edits to items assigned to someone show up in that person's inbox.
6. Parkings have a `privateToMe` toggle; private parkings are only visible to the creator and render with a lock icon inline with shared parkings on the ParkingsPage.
7. Parkings support `involved_ids[]` — tagging teammates who should see the parking before standup.
8. Brands are visible to every team member; all brand sub-entities (stakeholders, meetings, action items, feature requests) are team-shared.
9. Brand meeting attendees whose email matches an @omnirev.ai team member are auto-linked to that user record.
10. A new `/team` page (Team Task View) exists, showing tasks grouped by assignee (one section per team member). Keyboard navigation works (j/k within section, `]`/`[` between sections).
11. A new `/inbox` page exists with three event types: assignments (tasks + action items), parking involvement, and edits to my items. Per-item read state with "mark all as read."
12. Sidebar shows the current user's avatar bottom-left and an unread-count badge on the Inbox nav entry.
13. Each brand's Overview tab has a collapsible "Recent Activity" panel showing the last N events on that brand.
14. The End of Day Review has a team pulse strip showing team completion rate for the day + count of teammates with in-progress tasks.
15. The Weekly Stats modal has two tabs: "Mine" (existing) and "Team" (per-person completion rate, estimation accuracy, streak, most active role).
16. Users can be soft-deleted via a `deactivated_at` column; deactivated users cannot log in; their avatars render greyed-out in historical contexts.
17. Schema export/import bumped to version `1.4` with backward-compat loaders for `1.0`–`1.3`.
18. ShortcutsModal updated with all new bindings (`A`, `v`, `g u`, `@` filter, inbox nav).
19. Release notes entry for v0.7.0 added to `apps/web/src/lib/releaseNotes.ts`.
20. Migration runs cleanly against Nader's existing data: tasks/parkings stay as his (creator=assignee=him, private parkings default off), brands become team-visible automatically, roles migrate from per-user to team-wide.

---

## 3. Explicitly Out of Scope

These are non-negotiable V1 exclusions. No exceptions during implementation.

- **Multi-team support.** Only one team (Omnirev) ever.
- **Admin/member permission tiers.** Flat access only.
- **Invitation flow.** JIT provisioning via domain allowlist is the entire onboarding mechanism.
- **SSO / SAML / OAuth.** Email + password only.
- **@mentions in free-text fields.** Deferred to V1.5.
- **Global activity feed.** Per-brand activity only. Never a firehose page.
- **Real-time collaboration (WebSockets, SSE, CRDTs).** Pull-on-open + query invalidation continues.
- **Per-user tldv API keys.** The server-side `TLDV_API_KEY` env var remains Nader's only.
- **Team-level daily rituals.** Plan My Day stays personal. No "Team Plan My Day."
- **Brand DRI / primary owner / contributor tracking.** Brands are flat.
- **Public / external sharing.** Nothing is shared outside the team.
- **Audit log / immutable event history.** The inbox/brand events tables are for UX, not compliance. Mutable.
- **Email / push / Slack notifications.** Inbox surface only.
- **Task reassignment history.** The inbox records edits on items assigned to you, but there is no per-task "assignment history" view in V1.
- **Parking visibility history.** A parking toggled from private → shared does not flag this to previously-excluded users.

---

## 4. Architectural Principles

### 4.1 No `teams` table

Because only one team will ever exist, there is no `teams` table. Shared entities simply drop their `user_id` column and become visible to any authenticated user. The domain allowlist on signup IS the tenant boundary.

This is the opposite of the typical B2B SaaS playbook, but matches the hard constraint: we'd be adding a one-row table and a one-value FK purely for abstractness, with no functional benefit. Simpler is better here.

### 4.2 JWT and auth

JWT payload stays minimal: `{ sub: userId, email }`. No team claim, no domain claim.

The Fastify auth plugin (`apps/api/src/plugins/auth.ts`) continues to expose `req.userId`. That's all route handlers need.

Signup gate logic lives in `routes/auth.ts`:

```ts
const ALLOWED_DOMAINS = ['omnirev.ai'];
const domain = email.split('@')[1]?.toLowerCase();
if (!ALLOWED_DOMAINS.includes(domain)) {
  return badRequest('Signup is restricted to @omnirev.ai email addresses.');
}
```

### 4.3 Personal vs. shared entity scoping

| Entity                   | Scope                                            | Column(s)                                             |
| ------------------------ | ------------------------------------------------ | ----------------------------------------------------- |
| `users`                  | N/A (auth primitive)                             | —                                                     |
| `user_settings`          | Personal                                         | `user_id`                                             |
| `daily_logs`             | Personal                                         | `user_id`                                             |
| `roles`                  | Team-shared                                      | (no user_id)                                          |
| `tasks`                  | Personal workspace, team-visible                 | `creator_id`, `assignee_id`                           |
| `parkings`               | Mostly shared; private if `visibility='private'` | `creator_id`, `involved_ids[]`, `visibility`          |
| `brands`                 | Team-shared                                      | (no user_id)                                          |
| `brand_stakeholders`     | Team-shared                                      | (no user_id)                                          |
| `brand_meetings`         | Team-shared                                      | (no user_id)                                          |
| `brand_action_items`     | Team-shared                                      | `creator_id`, `assignee_id` (nullable)                |
| `brand_feature_requests` | Team-shared                                      | (no user_id)                                          |
| `brand_events` (new)     | Team-shared                                      | (no user_id — events reference `actor_id`)            |
| `inbox_events` (new)     | Per-user                                         | `user_id` (the recipient), `actor_id` (the initiator) |

### 4.4 Flat edit permissions

Any authenticated user can mutate any team-shared entity or any task/parking. API routes do not enforce per-entity authorization beyond authentication.

The only authorization distinction: `user_settings` and `daily_logs` are personal-scope — a user can only read/write their own row.

### 4.5 Synchronization model

Unchanged from today: pull-on-open via TanStack Query, invalidate on mutation. No real-time infra.

Every page with shared data gains a "Refresh" affordance (already exists on brands; extended consistently). TanStack Query's `staleTime` for shared entities drops to 30 seconds so tab-switching naturally refetches.

### 4.6 Event recording

Two event tables serve distinct surfaces:

- `brand_events` — per-brand activity timeline. Written on any write that touches a brand or its sub-entities. Read by the per-brand Overview panel.
- `inbox_events` — per-user inbox notifications. Written on specific triggers (assignment, parking involvement, edit-to-assigned-item). Read by the `/inbox` page.

These are distinct tables with distinct write triggers. An assignment event writes to BOTH tables (one brand_event for the brand's activity panel, one inbox_event for the assignee's inbox).

---

## 5. Data Model Changes

### 5.1 `users` table — additions

```sql
ALTER TABLE users ADD COLUMN display_name text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_color text NOT NULL DEFAULT '#4F8EF7';
ALTER TABLE users ADD COLUMN deactivated_at timestamptz NULL;
CREATE INDEX idx_users_active ON users(id) WHERE deactivated_at IS NULL;
```

- `display_name` — user-facing name. Populated from `user_settings.user_name` on migration; collected in first-run wizard for new users. Overrides the legacy per-user setting going forward.
- `avatar_color` — deterministic hex from email hash at signup time; stored for easy retrieval. Palette: the same `ROLE_COLOR_PALETTE` already in `packages/shared`.
- `deactivated_at` — soft-delete timestamp. A non-null value blocks login, hides the user from assignee pickers, and greys out their avatar in historical contexts.

### 5.2 `roles` table — refactor to team-wide

```sql
-- Drop user_id; roles are team-wide
-- Before migration, coalesce Nader's existing roles as the team palette.
ALTER TABLE roles DROP CONSTRAINT roles_user_id_fkey;
ALTER TABLE roles DROP COLUMN user_id;
DROP INDEX roles_user_id_idx;
```

Existing routes:

- `GET /roles` — no change in shape; returns all roles (team-wide).
- `POST /roles` / `DELETE /roles/:id` — now affect the whole team. This is intentional; consistent with flat permissions.

### 5.3 `tasks` table — creator + assignee split

```sql
ALTER TABLE tasks RENAME COLUMN user_id TO assignee_id;
ALTER TABLE tasks ADD COLUMN creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT;
-- Backfill: creator_id := assignee_id for all existing rows (Nader owns both).
UPDATE tasks SET creator_id = assignee_id WHERE creator_id IS NULL;

CREATE INDEX idx_tasks_assignee_scheduled ON tasks(assignee_id, scheduled_date);
CREATE INDEX idx_tasks_creator ON tasks(creator_id);
```

- Invariant: `MAX_IN_PROGRESS = 2` is per-assignee (unchanged from current per-user).
- Queries: `GET /tasks?assigneeId=&creatorId=&...` supersedes current filters (see § 7.1).

### 5.4 `parkings` table — shared + visibility

```sql
ALTER TABLE parkings RENAME COLUMN user_id TO creator_id;
CREATE TYPE parking_visibility AS ENUM ('team', 'private');
ALTER TABLE parkings ADD COLUMN visibility parking_visibility NOT NULL DEFAULT 'team';
ALTER TABLE parkings ADD COLUMN involved_ids uuid[] NOT NULL DEFAULT '{}';

-- Migration: Nader's existing parkings default to 'private'
-- (safest — no one else on the team yet, and when someone joins,
-- they shouldn't suddenly see parkings Nader wrote in isolation).
UPDATE parkings SET visibility = 'private';

CREATE INDEX idx_parkings_visibility ON parkings(visibility);
CREATE INDEX idx_parkings_involved ON parkings USING gin(involved_ids);
```

### 5.5 `brands` and sub-entities — drop user_id

```sql
-- brands
ALTER TABLE brands DROP CONSTRAINT brands_user_id_fkey;
ALTER TABLE brands DROP COLUMN user_id;

-- stakeholders, meetings, feature_requests — drop user_id
ALTER TABLE brand_stakeholders DROP COLUMN user_id;
ALTER TABLE brand_meetings DROP COLUMN user_id;
ALTER TABLE brand_feature_requests DROP COLUMN user_id;
```

### 5.6 `brand_action_items` — creator + assignee

```sql
ALTER TABLE brand_action_items RENAME COLUMN user_id TO creator_id;
ALTER TABLE brand_action_items ADD COLUMN assignee_id uuid NULL REFERENCES users(id) ON DELETE SET NULL;
-- Backfill: creator_id stays (Nader), assignee_id stays NULL until explicitly set
-- (action items without a human owner remain unassigned).

CREATE INDEX idx_bai_assignee ON brand_action_items(assignee_id);
```

### 5.7 `brand_meetings` — attendee linking

```sql
ALTER TABLE brand_meetings ADD COLUMN attendee_user_ids uuid[] NOT NULL DEFAULT '{}';
-- Backfill: for existing meetings, parse attendees[] text, match emails against users.email,
-- populate attendee_user_ids[]. Deferred to the migration script.

CREATE INDEX idx_bm_attendee_users ON brand_meetings USING gin(attendee_user_ids);
```

The existing `attendees text[]` column stays — it's still the canonical source for non-team attendees (clients, etc.). `attendee_user_ids[]` is the structured overlay.

### 5.8 `brand_events` — new table

```sql
CREATE TABLE brand_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_be_brand_created ON brand_events(brand_id, created_at DESC);
```

Event types (V1 set):

- `stakeholder_added`, `stakeholder_removed`, `stakeholder_edited`
- `meeting_added`, `meeting_edited`, `meeting_deleted`
- `action_item_created`, `action_item_completed`, `action_item_reopened`, `action_item_assigned`
- `feature_request_added`, `feature_request_resolved`, `feature_request_deleted`
- `brand_edited` (name, goals, success_definition changes)
- `recording_synced` (tldv meeting imported)

Payload shape: free-form JSON, per event type. Renderer (see §9.6) handles formatting per type.

Write path: a small helper `recordBrandEvent(brandId, actorId, eventType, entityType, entityId?, payload?)` in `apps/api/src/services/events.ts`, called from every mutating brand route. See §7 for route-by-route instrumentation.

### 5.9 `inbox_events` — new table

```sql
CREATE TABLE inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- recipient
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- who did it
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ie_user_read ON inbox_events(user_id, read_at, created_at DESC);
CREATE INDEX idx_ie_entity ON inbox_events(entity_type, entity_id);
```

Event types (V1 set):

- `task_assigned` — task assigned to you (creator ≠ assignee, or reassigned to you)
- `task_edited` — a task assigned to you was edited by someone else (title, priority, estimate, role, scheduled_date)
- `action_item_assigned` — brand_action_item assigned to you
- `action_item_edited` — action item assigned to you was edited (text, due_date, owner, status)
- `parking_involvement` — you were added to a parking's `involved_ids[]`

Suppression rule: never write an inbox_event where `actor_id = user_id` (don't notify yourself of your own actions). Enforced in the helper.

Write path: `recordInboxEvent(userId, actorId, eventType, entityType, entityId, payload?)` in `apps/api/src/services/events.ts`.

### 5.10 Full migration order

One consolidated migration `0005_team_space.sql`:

1. `users` — add columns, backfill `display_name` from `user_settings.user_name`, generate `avatar_color` from email hash.
2. `roles` — drop `user_id`.
3. `tasks` — rename to `assignee_id`, add `creator_id`, backfill.
4. `parkings` — rename to `creator_id`, add `visibility` (default 'private' for existing), add `involved_ids[]`.
5. `brands` + sub-entities — drop `user_id`.
6. `brand_action_items` — rename to `creator_id`, add `assignee_id`.
7. `brand_meetings` — add `attendee_user_ids[]`, backfill from existing `attendees` by email matching.
8. `brand_events` — create.
9. `inbox_events` — create.

Export file schema bumps to `1.4`. Backward-compat loaders for `1.0`–`1.3` populate defaults: missing `creator_id` falls back to the user who's importing; missing `visibility` defaults to `'private'`; missing `involved_ids[]` defaults to `[]`.

---

## 6. Auth Flow

### 6.1 Signup

Route: `POST /auth/register` — already exists. Changes:

```ts
// routes/auth.ts
const ALLOWED_SIGNUP_DOMAINS = ['omnirev.ai']; // hardcoded constant

app.post(
  '/auth/register',
  {
    schema: { body: registerInputSchema, response: { 201: authResponseSchema } },
  },
  async (req) => {
    const { email, password } = req.body;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !ALLOWED_SIGNUP_DOMAINS.includes(domain)) {
      throw badRequest('Signup is restricted to @omnirev.ai email addresses.');
    }
    // ... existing password hashing + user insert
    // NEW: generate avatar_color from email hash, leave display_name empty
    //      (first-run wizard fills display_name).
  },
);
```

The frontend's `RegisterPage` catches this error and renders a friendly inline message beneath the email field.

### 6.2 JIT provisioning

No explicit "team" concept means JIT is trivial: first user creates themselves, subsequent signups create themselves. No team-join step. Everyone who successfully signs up is implicitly on the Omnirev team.

### 6.3 JWT payload

Unchanged: `{ sub: userId }`. `email` added for client-side convenience, nothing load-bearing.

### 6.4 Login and deactivation

Route: `POST /auth/login`. Changes:

```ts
// routes/auth.ts
if (user.deactivated_at !== null) {
  throw badRequest('This account has been deactivated.');
}
```

Deactivation itself — turning the column from NULL to a timestamp — is done via a direct DB mutation in V1. No UI. (Acceptable for one operator running SQL against a rarely-used edge case.)

### 6.5 `/auth/me` response

Add `displayName`, `avatarColor` to `authUserSchema`:

```ts
authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  avatarColor: z.string(),
});
```

---

## 7. API Surface

### 7.1 Modified routes

#### Tasks — `routes/tasks.ts`

- `GET /tasks?assigneeId=&creatorId=&date=&roleId=&status=` — filters now include `assigneeId` (default: current user for backwards-compat) and `creatorId`. Omit `assigneeId=ALL` to return team-wide.
- `POST /tasks` — body gets `assigneeId` (optional, defaults to current user) and implicitly records `creatorId = current user`. If assignee ≠ creator, writes an `inbox_events.task_assigned` for the assignee.
- `PATCH /tasks/:id` — unchanged shape; on any edit, if the assignee ≠ the actor and the assignee is not the creator, write `inbox_events.task_edited` with payload describing changes.
- `POST /tasks/:id/start|pause|complete|defer` — unchanged. Status transitions by the assignee do NOT trigger inbox events (you did it yourself, or the creator watches via the group view).
- `GET /tasks/team` — **new.** Returns all team tasks, grouped by assignee for efficient rendering. Response: `{ sections: [{ user: UserSummary, tasks: Task[] }] }`. Default filter: today + active statuses. Query params: `?date=`, `?status=`.

#### Parkings — `routes/parkings.ts`

- `GET /parkings` — returns shared parkings + user's own private parkings. Others' private parkings are never returned.
- `POST /parkings` — body accepts `visibility` (default `'team'`) and `involvedIds[]` (default `[]`). Current user set as `creatorId`. For each user in `involvedIds`, write `inbox_events.parking_involvement` (skip self).
- `PATCH /parkings/:id` — body accepts partial updates including `visibility`, `involvedIds`. If `involvedIds` grows (new users added), write inbox events for new additions only. If the parking is `private`, only the creator can PATCH.
- `DELETE /parkings/:id` — if `private`, only creator can delete; otherwise any authenticated user can.
- `POST /parkings/:id/discuss|reopen` — unchanged.

#### Brands — `routes/brands.ts`

- All routes drop `user_id` scoping. Queries become "list all brands" / "get brand by id".
- `POST /brands` — logs a `brand_events.brand_edited` with payload `{ action: 'created' }`.
- `PATCH /brands/:id` — logs `brand_events.brand_edited` with payload describing changed fields.
- `DELETE /brands/:id` — logs `brand_events.brand_edited` with `{ action: 'deleted' }`. Cascade unchanged.

#### Brand stakeholders — `routes/brand-stakeholders.ts`

- All routes drop `user_id` scoping.
- `POST` / `PATCH` / `DELETE` — each logs `stakeholder_*` brand events.

#### Brand meetings — `routes/brand-meetings.ts`

- `POST /brands/:brandId/meetings` — now also computes `attendee_user_ids[]` by email-matching `attendees[]` against the `users` table. Logs `meeting_added`.
- `PATCH` — recomputes `attendee_user_ids[]` if `attendees[]` changes. Logs `meeting_edited`.
- `DELETE` — logs `meeting_deleted`.

#### Brand action items — `routes/brand-action-items.ts`

- `POST` — body accepts `assigneeId` (optional). Logs `action_item_created`. If `assigneeId` set and ≠ actor, writes `inbox_events.action_item_assigned`.
- `PATCH` — reassignment (change of `assigneeId`) logs `action_item_assigned` brand event AND writes `inbox_events.action_item_assigned` for new assignee. Other edits (text, due, owner) log `action_item_edited` for both surfaces; inbox event only if assignee ≠ actor.
- `POST /brands/:brandId/action-items/:id/send-to-today` — body now REQUIRES `{ assigneeId: uuid }`. Creates the task with the given assignee. If assignee ≠ actor, writes `inbox_events.task_assigned`. Returns `{ actionItem, task }`.
- `POST /action-items/:id/complete` — logs `action_item_completed`. Unchanged functionally.

#### Brand feature requests — `routes/brand-feature-requests.ts`

- Drop `user_id` scoping; otherwise unchanged. Logs `feature_request_*` brand events on each mutation.

#### Brand sync (tldv) — `routes/brand-sync.ts`

- `POST /sync/confirm` — the confirm route that imports meetings gains attendee-linking logic: after creating/merging each meeting, match tldv attendee emails against team users and populate `attendee_user_ids[]`. Logs `recording_synced` brand event.

#### Roles — `routes/roles.ts`

- `GET /roles` — unchanged response shape, but now returns team-wide roles.
- `POST /roles` — team-wide create. Any user can create.
- `DELETE /roles/:id` — team-wide delete. Any user can delete. Cascades task/parking `role_id = null`.

#### Settings — `routes/settings.ts`

- `GET /settings` / `PUT /settings` — unchanged shape. `user_settings.user_name` becomes redundant (superseded by `users.display_name`); keep the column for v1.4 import compatibility but stop writing to it from the UI. Update `display_name` instead.

### 7.2 New routes

#### Inbox — `routes/inbox.ts` (new file)

- `GET /inbox?unreadOnly=&limit=&cursor=` — returns current user's inbox events. Includes hydrated entity summaries (task title, parking title, etc.). Default limit 50.
- `POST /inbox/:id/read` — mark single event read. Sets `read_at = now()`.
- `POST /inbox/read-all` — mark all current user's unread events read.
- `GET /inbox/unread-count` — cheap badge query. Returns `{ count: number }`.

#### Brand events — `routes/brand-events.ts` (new file)

- `GET /brands/:brandId/events?limit=&cursor=` — returns brand events with actor hydrated (`{ userId, displayName, avatarColor }`). Default limit 20. Used by the brand Overview "Recent Activity" panel.

#### Users — `routes/users.ts` (new file)

- `GET /users` — list all active team users. Returns `UserSummary[]` (`{ id, displayName, email, avatarColor, deactivatedAt }`). Used by assignee pickers, team task view, avatar hydration.
- `GET /users/:id` — fetch specific user (for hydration in non-cached contexts).

Note: no admin routes to create/deactivate users. Signup creates. Deactivation is SQL-only in V1.

#### Stats — `routes/stats.ts`

- `GET /stats/team-weekly` — new endpoint. Returns team weekly stats: `{ users: Array<{ user: UserSummary, completionRate, estimationAccuracy, streak, mostActiveRoleId }> }`.
- `GET /stats/team-today` — cheap endpoint for the EOD pulse strip. Returns `{ teamCompletionRate, usersWithInProgressCount }`.

### 7.3 Event recording helpers

New file `apps/api/src/services/events.ts`:

```ts
export async function recordBrandEvent(params: {
  brandId: string;
  actorId: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}): Promise<void>;

export async function recordInboxEvent(params: {
  userId: string; // recipient
  actorId: string; // initiator
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}): Promise<void>; // no-op if userId === actorId
```

Both helpers are fire-and-forget from route handlers (awaited to guarantee ordering, but failures are logged and swallowed — they must not break the main mutation).

---

## 8. Shared Schema Changes (`packages/shared/src/schemas.ts`)

New / modified Zod schemas (names are authoritative; field types follow the SQL above):

- `userSummarySchema` — `{ id, displayName, email, avatarColor, deactivatedAt }`. Used across hydrated responses.
- `authUserSchema` — gains `displayName`, `avatarColor`.
- `taskSchema` — `user_id` → `assigneeId`; add `creatorId`.
- `createTaskInputSchema` — adds `assigneeId: z.string().uuid().optional()`.
- `updateTaskInputSchema` — adds `assigneeId: z.string().uuid().optional()`.
- `parkingSchema` — `user_id` → `creatorId`; add `visibility: z.enum(['team', 'private'])`, `involvedIds: z.array(z.string().uuid())`.
- `createParkingInputSchema` / `updateParkingInputSchema` — add `visibility`, `involvedIds`.
- `brandActionItemSchema` — `user_id` → `creatorId`; add `assigneeId: z.string().uuid().nullable()`.
- `sendActionItemToTodayInputSchema` — new: `{ assigneeId: z.string().uuid() }`.
- `brandMeetingSchema` — add `attendeeUserIds: z.array(z.string().uuid())`.
- `inboxEventSchema` — new: `{ id, userId, actorId: userSummarySchema, eventType, entityType, entityId, payload, readAt, createdAt, entity: someUnionOfEntitySummaries }`.
- `brandEventSchema` — new: `{ id, brandId, actor: userSummarySchema, eventType, entityType, entityId, payload, createdAt }`.
- `teamWeeklyStatsSchema` — new: `{ users: Array<{ user, completionRate, estimationAccuracy, streak, mostActiveRoleId }> }`.
- `teamTodayStatsSchema` — new: `{ teamCompletionRate, usersWithInProgressCount }`.
- `teamTaskListSchema` — new: `{ sections: Array<{ user: userSummarySchema, tasks: taskSchema[] }> }`.
- `exportFileSchema` — bump version to `'1.4'`; include new collections (`inboxEvents`, `brandEvents`, `users` with `displayName`, `avatarColor`).

The quick-add parser in `packages/shared/src/parser.ts` gains an `@username` token:

```ts
// Grammar addition:
// @alice → assigneeToken (resolved client-side to assigneeId by matching users.displayName)
```

Matching is case-insensitive on the first name or display name. If no match, `@alice` stays in the title (same fallback as unknown role tags).

---

## 9. UX Surfaces

### 9.1 Avatars + identity

- **Avatar component** — `components/Avatar.tsx` (new). Props: `{ user: UserSummary, size: 'xs'|'sm'|'md', showTooltip?: boolean }`. Renders colored circle with initials (first letter of first name + first letter of last word, or first two letters of email if no space).
- **Avatar stack component** — `components/AvatarStack.tsx` (new). Props: `{ users: UserSummary[], max: number }`. For `involved_ids[]` rendering.
- **Deactivated users** render with grey color, reduced opacity, and a "(deactivated)" tooltip.

### 9.2 Sidebar changes

`layout/Sidebar.tsx`:

- Bottom-left area: current user's avatar (md size) with display name + email on hover. Clicking opens Settings modal (new; nothing currently takes you to settings — add a lightweight inline settings modal with capacity, theme, display name).
- New nav entry: "Inbox" with unread-count badge (`count` from `GET /inbox/unread-count`, polled every 30s).
- New nav entry: "Team" (maps to `/team` Team Task View).
- Brand list: each brand row gains a subtle dot indicator if there are unseen brand_events since the user last opened that brand. Tracked client-side via `localStorage.momentum-brand-last-seen` (keyed by brand id → ISO timestamp).

### 9.3 Today view

`pages/TodayPage.tsx`:

- Task cards gain an assignee avatar (xs size, top-right corner). If task is assigned to current user, no badge (reduces visual noise for the common case). If assigned to someone else, show their avatar.
- Filter bar gains "Mine / Everyone" chip (default "Mine" — only tasks where `assigneeId = currentUser`).
- `A` keyboard shortcut opens the assignee picker modal for the selected task.
- Task input bar: the quick-add parser now handles `@alice` modifier; preview chip shows the assignee as you type.

### 9.4 Backlog view

`pages/BacklogPage.tsx`:

- Filter chips: "Mine / Unassigned / Everyone" (default "Mine").
- Task rows show assignee avatar.

### 9.5 Parkings page

`pages/ParkingsPage.tsx`:

- Each parking card shows:
  - Creator avatar (leading)
  - AvatarStack for `involved_ids[]` after the title
  - Lock icon + muted opacity if `visibility === 'private'`
- Input bar grows a visibility toggle (default team; click to private). `v` keyboard shortcut toggles on the selected parking.
- `I` shortcut (capital) opens an involved-users picker on the selected parking.
- Filter chips: "Mine / Involving me / All" (default "All") — "Mine" shows only parkings I created, "Involving me" shows parkings where I'm in `involvedIds`, "All" shows everything visible to me.

### 9.6 Brands section

`pages/BrandsPage.tsx` and `components/brands/*`:

- `BrandListRail` — each brand gets the recent-events dot described in 9.2.
- `OverviewTab` — gains a new "Recent Activity" section (collapsible, default expanded for first 5 events, collapsible after). Renders `brand_events` in reverse-chronological order with:
  - Actor avatar + display name
  - Event description (e.g., "Sara completed action item: Send proposal to Boudin")
  - Relative timestamp
  - Click event → navigate to entity (action item in Work tab, meeting in archive, etc.)
- `ActionItemsSection` — each row shows creator + assignee avatars. Assignee picker available via `A` key or click.
- `MeetingsSection` — each meeting card shows attendee avatars for linked team members + plain email text for non-team attendees.
- `SendToTodayButton` — always opens a person-picker modal (see 9.11).

### 9.7 Team Task View (NEW)

`pages/TeamPage.tsx` (new). Route: `/team`. Accessible via `g u` keyboard shortcut or sidebar nav.

Layout: vertically stacked sections, one per active team user, ordered by:

1. Current user first (your own section is always on top)
2. Then alphabetically by display name
3. Deactivated users hidden by default (toggle to show)

Each section:

- Header: user avatar (md) + display name + small stats strip (`{X in progress} · {Y up next} · {Z done today}`)
- Three-column mini-kanban: Up Next / In Progress / Done (same column model as Today, scoped to that user and today by default)
- Collapsible — clicking header collapses/expands

Keyboard:

- `j/k` — navigate tasks within the currently-focused section's active column
- `h/l` — switch columns within the current section
- `]` / `[` — move to next / previous user's section
- `f` — cycle date filter (today / this week / all scheduled)
- `e` — edit task inline (title only)
- `A` — open assignee picker (same as other views)
- `Enter` — open task detail in modal (new modal, doesn't exist today — see 9.11)
- `Esc` — close detail modal

Scope filter (top bar): "Today (default) / This week / All scheduled". Role filter chips (existing pattern).

### 9.8 Inbox page (NEW)

`pages/InboxPage.tsx` (new). Route: `/inbox`. Accessible via `g i` keyboard shortcut or sidebar nav.

Layout: single scrollable list, reverse-chronological. Each row:

- Actor avatar + display name (leading)
- Event description, bolded if unread
- Relative timestamp (trailing)
- Entity preview (title/snippet) as a secondary line
- Click row → navigate to entity; automatically marks read
- Keyboard focus ring when navigating via `j/k`

Top bar:

- Unread count badge
- "Mark all as read" button (clears all unread for current user)
- Filter chip: "Unread / All" (default "Unread")

Event rendering:

- `task_assigned`: "**Sara** assigned you a task: _Review Boudin proposal_"
- `task_edited`: "**Sara** changed the priority on _Review Boudin proposal_ from medium to high"
- `action_item_assigned`: "**Sara** assigned you an action item on _Boudin_: _Send proposal draft_"
- `action_item_edited`: "**Sara** updated an action item on _Boudin_"
- `parking_involvement`: "**Sara** added you to a parking: _Pipeline review — need a decision from Nader_"

Keyboard:

- `j/k` — navigate list
- `Enter` — open selected entity (marks read)
- `Space` — toggle read/unread on selected
- `r` then `a` — mark all read
- `Esc` — close page? (actually, Esc on a page doesn't do anything; this isn't a modal.) Navigate back to previous view with browser back or `g t`.

### 9.9 EOD Review modal

`modals/EndOfDayModal.tsx` changes:

- Existing layout (your completions, journal entry) stays primary.
- Add a `TeamPulseStrip` component at the bottom. Renders:
  - "Team today: **82% completion** · **2 teammates still working**"
  - Small, muted styling — does not compete with the journal
- Data source: `GET /stats/team-today`.

### 9.10 Weekly Stats modal

`modals/WeeklyStatsModal.tsx` changes:

- Add a tab bar at the top: "Mine" | "Team".
- "Mine" tab: existing content unchanged.
- "Team" tab: table with one row per active team user:
  - User avatar + display name
  - Completion rate (sparkline or bar)
  - Estimation accuracy (ratio)
  - Streak (number)
  - Most active role (pill)
- Keyboard: `[` / `]` switches tabs.

### 9.11 First-run wizard for new users

`pages/FirstRunWizard.tsx` changes:

- Detect: if `user.displayName === ''` (empty), wizard is required.
- Steps:
  1. **Display name** — text input, required.
  2. **Daily capacity** — same as existing step.
- Dropped: the role-picking step. Roles are team-defined; new users inherit them.
- On submit: `PUT /settings` (capacity) + `PATCH /users/me` (new route? or use `PUT /settings` to also update display_name) — pick one and wire it.

### 9.12 New modals

- `AssigneePickerModal` (`modals/AssigneePickerModal.tsx`) — new. Fetches `GET /users`, renders list with number-key shortcuts (1–9), fuzzy search, Enter to confirm, Esc to cancel. Used by:
  - Task `A` shortcut
  - Brand action item assignment
  - "Send to Today" from brand action item
  - "Reassign task" command in palette
- `TaskDetailModal` (`modals/TaskDetailModal.tsx`) — new. Opened from Team Task View row. Read + edit form matching existing inline-edit capabilities. Keyboard-first. Closed via Esc.
- `InvolvedUsersPickerModal` — variant of AssigneePickerModal supporting multi-select. Triggered by `I` on a parking.

---

## 10. Keyboard Shortcuts

### 10.1 New global shortcuts

Register in `hooks/useGlobalShortcuts.ts`:

- `g u` — navigate to `/team` (Team Task View). Add to `VIEW_CYCLE` array so `[`/`]` cycles through it. Order: `['/', '/backlog', '/parkings', '/team', '/brands', '/inbox']`.
- `g i` — navigate to `/inbox`.
- `@` — focus the person-filter chip on the current page (Today / Backlog / Parkings / Team). No-op if no filter exists.

### 10.2 New page-scoped shortcuts

In `hooks/useKeyboardController.ts` and page-specific handlers:

- `A` — open AssigneePickerModal for the selected task / action item.
- `v` — toggle visibility on the selected parking (shared ↔ private). Only works if current user is the creator.
- `I` — open InvolvedUsersPickerModal for the selected parking.
- `m` `a` — "mark all read" on InboxPage.
- `Space` on InboxPage — toggle read/unread on selected event.

### 10.3 ShortcutsModal updates

Add three new sections to `modals/ShortcutsModal.tsx SECTIONS`:

- **Team**: `g u`, `@` (filter), `A` (assign), `I` (involve on parking), `v` (visibility toggle)
- **Inbox**: `g i`, `j/k`, `Enter`, `Space`, `m a`
- **Team Task View**: `j/k` (within section), `]`/`[` (between sections), `h/l` (columns), `f` (date scope), `A` (reassign), `Enter` (open detail)

Per `CLAUDE.md`: any keydown change must update ShortcutsModal in the same commit.

### 10.4 Shortcut conflicts to verify

- `I` on parking — the current `I` global (`⌘I` for import) uses Cmd; bare `I` is free.
- `A` on tasks — currently unused on tasks (today view has `e`, `r`, `p`, `d`, Space, Enter — no `A`).
- `@` focus — currently handled as a typeable character in inputs; only fires outside input focus.

---

## 11. Migration Strategy (Nader's Existing Data)

Migration script `packages/db/drizzle/0005_team_space.sql` + a one-off TypeScript migration runner `packages/db/src/migrations/team-space-backfill.ts` for non-SQL work (email hashing, email matching). Run order:

1. Create new columns (`users.display_name`, `users.avatar_color`, `users.deactivated_at`).
2. Backfill `display_name` from `user_settings.user_name` (if set) or from email local-part.
3. Generate `avatar_color` from email hash (deterministic; pick from `ROLE_COLOR_PALETTE`).
4. Rename `tasks.user_id` → `assignee_id`; add `creator_id`, backfill with `assignee_id`.
5. Rename `parkings.user_id` → `creator_id`; add `visibility` with default `'private'` for existing rows (safety); add `involved_ids[] DEFAULT '{}'`.
6. Drop `user_id` from `brands`, `brand_stakeholders`, `brand_meetings`, `brand_feature_requests`.
7. Rename `brand_action_items.user_id` → `creator_id`; add `assignee_id NULL`.
8. Add `brand_meetings.attendee_user_ids[] DEFAULT '{}'`; backfill by email-matching `attendees[]` against `users.email`.
9. Drop `roles.user_id`.
10. Create `brand_events`, `inbox_events` tables (empty — no backfill).
11. Export file version bumps to `1.4` with backward-compat loaders.

**Data preservation guarantees:**

- Nader loses nothing: all his tasks, parkings, brands, action items remain.
- His existing parkings default to private — when Sara and Ryan join, they won't see parkings he wrote in isolation.
- His existing tasks remain his (creator = assignee = him).
- Existing brands become visible to all new users immediately upon signup. This is the intended behavior per the product decisions.

**Rollback:** the migration is non-destructive at the column level (drops are terminal, but the new columns can be recreated from backups). Taking a DB snapshot before the migration is sufficient rollback.

---

## 12. Testing Strategy

Per CLAUDE.md convention — tests ship in the same commit as the runtime change.

### 12.1 Required test coverage

- **Schema tests** (`packages/shared/src/schemas.test.ts`): new schemas validate correctly, new fields accept valid values and reject invalid.
- **Parser tests** (`packages/shared/src/parser.test.ts`): `@alice` token parses to `assigneeToken`; unmatched `@foo` stays in title.
- **Route tests** (`apps/api/src/routes/*.test.ts`):
  - Signup rejects non-@omnirev.ai emails.
  - Signup accepts @omnirev.ai, creates user with generated avatar_color.
  - Deactivated users cannot log in.
  - Task assignment to another user writes an `inbox_events.task_assigned`.
  - Task edit by non-assignee writes an `inbox_events.task_edited`; self-edit does not.
  - Parking `involved_ids` additions write inbox events (only for newly added users).
  - Private parkings are NOT returned in other users' `GET /parkings`.
  - Private parkings CANNOT be edited/deleted by non-creators.
  - `POST /action-items/:id/send-to-today` rejects without `assigneeId`.
  - Brand meeting attendees auto-populate `attendee_user_ids[]` via email match.
  - `GET /inbox` returns only current user's events.
  - `GET /tasks/team` returns grouped-by-assignee sections.
  - Brand event helper writes a row on every mutating brand operation.
- **Event suppression test**: `recordInboxEvent` is a no-op when `userId === actorId`.
- **Migration test**: run the full migration against a fixture DB containing Nader's dataset; assert every row's new columns have sane defaults.

### 12.2 Client tests

- `AvatarStack` renders max N + overflow count.
- `AssigneePickerModal` — keyboard navigation (1–9, Enter, Esc).
- `InboxPage` — clicking row marks read; "Mark all read" clears all.
- `TeamPage` — sections render per user; keyboard nav moves between sections.
- `BrandOverviewTab` activity panel renders events grouped appropriately.
- `parseQuickAdd("Buy domain ~30m #product @alice")` returns expected tokens.

### 12.3 E2E-ish flow tests

At minimum, one test per workflow moment in §1 using the existing test harness (mock DB + Fastify inject).

---

## 13. Engineering Task Breakdown

This is the sequenced breakdown Claude Code works against. Data model first, API second, UI third, polish last. Each task is self-contained enough to be a single commit.

### Phase 1 — Foundations (data model + auth)

1. **Schema migration 0005_team_space.sql** — all column changes per §5 and §11. Test harness passes.
2. **Shared Zod schemas update** — all new / modified schemas per §8. Schema tests pass.
3. **Quick-add parser: `@alice` token** — parser.ts + parser.test.ts.
4. **Mappers update** — `apps/api/src/mappers.ts` for new fields (assignee, creator, visibility, involved_ids, attendee_user_ids, display_name, avatar_color).
5. **Auth: domain allowlist + deactivation check** — `routes/auth.ts` update + tests.
6. **Users route** — new `routes/users.ts` (GET /users, GET /users/:id) + tests.
7. **Event helpers** — `services/events.ts` (`recordBrandEvent`, `recordInboxEvent`) + tests.

### Phase 2 — API routes (per-resource)

8. **Tasks route update** — creator/assignee fields, inbox event writes, `GET /tasks/team` + tests.
9. **Parkings route update** — visibility, involved_ids, inbox events + tests.
10. **Brands + sub-entities routes** — drop user_id scoping, brand event writes + tests.
11. **Brand action items route** — creator/assignee fields, `send-to-today` assignee requirement, inbox events + tests.
12. **Brand meetings route** — attendee_user_ids auto-population on POST/PATCH + tests.
13. **Brand sync (tldv) route** — attendee linking in confirm flow + `recording_synced` event.
14. **Inbox routes** — new `routes/inbox.ts` (GET, read, read-all, unread-count) + tests.
15. **Brand events route** — new `routes/brand-events.ts` + tests.
16. **Team stats routes** — `GET /stats/team-weekly`, `GET /stats/team-today` + tests.
17. **Roles route update** — drop user_id scoping + tests.
18. **Data export/import** — version 1.4 + backward-compat loaders + tests.

### Phase 3 — Client foundations

19. **API hooks (TanStack Query)** — add hooks for: users list, inbox events, brand events, team tasks, team weekly stats, team today stats. Update task/parking/action-item hooks for new fields.
20. **Auth UX** — domain-rejected signup message, login error for deactivated users.
21. **First-run wizard** — drop role step; add display_name step.
22. **Avatar components** — `Avatar`, `AvatarStack`.
23. **AssigneePickerModal + InvolvedUsersPickerModal** — keyboard-first, uses `GET /users`.

### Phase 4 — Client surfaces (per-page)

24. **Sidebar update** — current user avatar, Inbox nav entry + badge, Team nav entry, brand unseen-dot.
25. **Today page update** — assignee avatars on cards, Mine/Everyone filter, `A` shortcut, `@alice` in quick-add.
26. **Backlog page update** — Mine/Unassigned/Everyone filter, assignee avatars.
27. **Parkings page update** — visibility toggle, involved AvatarStack, lock icon, `v` / `I` shortcuts, Mine/Involving me/All filter.
28. **Brand Overview: Recent Activity panel** — new component + wiring.
29. **Brand Work tab update** — creator/assignee avatars on action items, assignee picker wiring, `send-to-today` picker flow.
30. **Brand Meetings update** — attendee avatar rendering for team members.
31. **Team Task View page** — new page, grouped layout, keyboard nav, `f` date filter.
32. **Inbox page** — new page, event rendering, read state, mark-all-read, keyboard nav.
33. **EOD review: team pulse strip** — new component, wire to `GET /stats/team-today`.
34. **Weekly Stats: Team tab** — tab bar, team table, wire to `GET /stats/team-weekly`.
35. **TaskDetailModal** — new modal for Team Task View's Enter action.

### Phase 5 — Polish + shortcuts + release

36. **Global shortcuts update** — `g u`, `g i`, `@` filter, VIEW_CYCLE update.
37. **Page-scoped shortcuts update** — `A`, `v`, `I`, `m a`, `Space` (inbox), arrow/j/k on new pages.
38. **ShortcutsModal update** — three new sections (Team, Inbox, Team Task View).
39. **Release notes entry** — v0.7.0 in `lib/releaseNotes.ts` with items per Done Criteria §2.
40. **docs/TODO.md update** — prune items shipped, add deferred V1.5 items (@mentions, notifications beyond inbox, brand events to slack, per-user tldv).
41. **README update** — mention team mode + domain-restricted signup.

### Phase 6 — Nader's data migration (manual runbook)

42. **Pre-migration DB snapshot.**
43. **Run 0005_team_space.sql** against staging DB; verify Nader's data is intact.
44. **Run team-space-backfill.ts** for email-based matching of existing meeting attendees.
45. **Smoke test**: Nader logs in, sees all his tasks/parkings/brands unchanged; new users' assignee picker includes him; brand pages work.
46. **Production migration** — same steps against production.

**Total estimated phases:** 6 phases, ~46 discrete tasks, ~3–4 weeks for a focused single-engineer effort (longer with context-switching or if Claude Code handles it incrementally with review gates).

---

## 14. Release Notes Preview (v0.7.0)

To be added to `apps/web/src/lib/releaseNotes.ts`:

> **Headline:** Momentum is now a team space.
>
> **Summary:** Momentum is now a shared operating system for the Omnirev team. Brands, meetings, and action items are team-visible. Tasks and parkings support assignment and involvement. A new Team Task View shows everyone's current work. A new Inbox surfaces things assigned to or involving you.
>
> **Items:**
>
> - Sign up with your @omnirev.ai email; your teammates can join the same way.
> - Tasks have creators and assignees. Press `A` to assign; type `@alice` in the quick-add bar.
> - Parkings can be shared (default) or marked private with `v`. Tag teammates to involve them.
> - Brands and meetings are team-visible. Every brand shows recent activity on its Overview tab.
> - New Team Task View (`g u`) shows everyone's Today grouped by person.
> - New Inbox (`g i`) shows things assigned to you, edits to your items, and parkings that tag you.
> - Your End of Day Review and private journal entries stay yours. Weekly Stats has a new Team tab.

---

## 15. Items Deferred to V1.5+

Things we explicitly skipped that we'll revisit:

- **@mentions in free-text fields** — autocomplete in meeting notes, parking notes, action item text, plus matching inbox surfacing.
- **Email / push / Slack notifications** — notifications beyond the in-app inbox.
- **Per-user tldv API keys** — each teammate connects their own recorder; sync de-dupes.
- **Real-time collaboration** — SSE on brand pages; optimistic UI with conflict resolution.
- **Admin UI for deactivation / role management** — right now deactivation is SQL-only.
- **Invitation flow with explicit onboarding email** — useful if we ever want to invite a contractor with a different email domain.
- **Full activity log / immutable audit trail** — brand_events / inbox_events today are mutable (DELETE works). A compliance-grade audit log would need append-only semantics.
- **Cross-brand search** — now that every user sees every brand, full-text search is more valuable than in single-user mode.
- **Public sharing (individual brand / meeting pages)** — e.g., share a meeting summary with a client stakeholder.

---

## 16. Open Risks + Watch Items During Build

Things that are likely to surface unexpected scope or bugs during implementation:

1. **Task invariant enforcement under reassignment.** `MAX_IN_PROGRESS = 2` is per-assignee. If Sara reassigns a task to Ryan when Ryan already has two in-progress, what happens? Proposal: the reassigned task is silently set to `status=todo, column=up_next`. Test this explicitly.
2. **Parking visibility flip.** If a private parking is switched to `team`, should `involved_ids[]` be pre-populated? Proposal: no; stay empty by default. The creator explicitly adds people.
3. **Inbox event explosion.** On a large brand update (e.g., bulk edit of 50 action items), we could write hundreds of inbox events. Mitigation: no bulk-edit endpoint currently exists, so V1 is safe. If bulk ops are added, wrap them in event de-duplication.
4. **Quick-add `@` collision with role tags.** `#product` vs. `@alice` must not overlap in the parser state machine. Test edge cases (`@alice #product`, `#alice @product`, etc.).
5. **Migration edge case: Nader's parkings with no `target_date`.** Today's parkings default to unscheduled. After migration, they're private by default. When they're unscheduled AND private, they effectively vanish from the team's ParkingsPage. That's correct.
6. **First-run wizard regression for Nader.** Nader already has `onboarded=true`. His `display_name` will be backfilled from `user_settings.user_name` if present; if absent, from email local-part. Sanity-check his account post-migration.
7. **Auth plugin and deactivated-user race.** A user deactivated while logged in has a valid JWT. We don't invalidate it — they keep working until the JWT expires (7 days). For V1, acceptable. Add to deferred list: JWT revocation / refresh token flow.

---

## 17. What Claude Code Should Build First

If only 20% of this can be built first, build this:

1. Schema migration 0005 (task 1)
2. Shared Zod schemas (task 2)
3. Users route + auth updates (tasks 5–6)
4. Tasks route creator/assignee update (task 8)
5. Sidebar + avatars on Today view (tasks 22, 24, 25)

Shipping that gets us: domain-gated signup works, team users exist, tasks show assignees, basic assignment works. Everything else can iterate on top without breaking that foundation.
