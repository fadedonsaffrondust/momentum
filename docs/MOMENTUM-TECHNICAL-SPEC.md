# Momentum — Technical Specification

> Exhaustive technical reference for the Momentum codebase. Intended as context for planning future features. Captures what is actually shipped, not what is aspired to. When this document disagrees with the code, the code wins — treat this as a high-fidelity snapshot, not a contract.
>
> **Current release:** v0.6.2 (2026-04-17)
> **Primary source of truth locations:** `packages/shared/src/schemas.ts` (data contracts), `packages/db/src/schema.ts` (database), `apps/api/src/routes/*` (API surface), `apps/web/src/App.tsx` (routing), `apps/web/src/modals/ShortcutsModal.tsx` (keyboard contract), `apps/web/src/lib/releaseNotes.ts` (user-visible changelog).

---

## 1. Product overview

Momentum is a single-user, keyboard-first daily execution + relationship-management web app. It started as a "daily task OS for founders" and grew sideways into a client-management surface without losing the keyboard-first ethos.

### Five load-bearing ideas

1. **Today-only by default.** The default landing view shows the work scheduled for today; everything else is one key away.
2. **Keyboard-first, everywhere.** Every screen has its own shortcut layer. `?` shows the complete map. The mouse is a fallback, never a first-class input path.
3. **Context-aware.** Tasks and parkings belong to "roles" (the hats a founder wears). `1`–`9` filter by role; `0` clears.
4. **Time-boxed.** Tasks carry `estimateMinutes`; a time-budget bar warns when scheduled work exceeds `dailyCapacityMinutes`.
5. **Opinionated ritual.** Plan My Day (⌘P), End of Day Review (⌘R), Weekly Stats (⌘W), Parkings (daily standup prep), and per-brand meeting logs drive workflow — not just a list.

### Feature surfaces currently shipped

| Surface | What it does |
|---|---|
| **Tasks** | Today / Backlog / Done kanban with roles, priorities, estimates. Up-next, In-progress (max 2), Done columns. Plan My Day + End of Day Review modals. Weekly Stats. |
| **Parkings** | Capture topics for your next daily standup. Grouped by day (Today / Tomorrow / Future / Unscheduled). Each has title, prep notes, outcome, target_date, role, priority. |
| **Brands** | Client/account management. Each brand has a North Star (goals + stakeholders + success definition), Pulse (health signal, open action items), Archive (meeting notes). Tabbed detail: Overview / Work / Feature Requests. |
| **Meeting recording sync (tldv)** | Per-brand: pull meeting recordings from tldv, score against stakeholder emails + title keywords, extract summary + action items + decisions via OpenAI, dedupe action items via LLM, merge same-day notes. |
| **Feature Requests** | Per-brand: connect a Google Sheet, two-way sync (pull + push), inline edit, filter/search, convert to action items. |
| **AI-assisted brand import** | Upload `.md`/`.txt` client notes; OpenAI extracts name/goals/stakeholders/meetings/action items into Momentum's schema. Async (brand row appears with `status: 'importing'`). |
| **Data export/import** | JSON dump/restore of the user's entire dataset. Versioned file format (currently `1.3`). Replace or merge. |
| **What's new modal** | Auto-opens once per new release. Source: `apps/web/src/lib/releaseNotes.ts`. |

### Non-goals (explicit)

- No SSR. The web client is a pure SPA.
- No ORM other than Drizzle.
- No CSS-in-JS; Tailwind + CSS variables only.
- No global Redux; Zustand for UI state, TanStack Query for server state.
- No multi-user sharing, no real-time collaboration, no deployment pipeline. (`docker-compose.yml` is local-dev-only.)

---

## 2. Architecture

```
┌────────────┐      HTTP / JSON       ┌────────────┐     SQL       ┌─────────────┐
│  Web SPA   │ ─────────────────────► │   API      │ ────────────► │  PostgreSQL │
│ React+Vite │ ◄───────────────────── │  Fastify   │ ◄──────────── │     16      │
└────────────┘      JWT bearer        └────────────┘   Drizzle      └─────────────┘
                                            │
                                            ├── OpenAI (extraction / dedup / import)
                                            ├── tldv  (meeting recordings)
                                            └── Google Sheets (feature requests)
```

- **Monorepo:** pnpm workspaces + Turborepo.
- **Frontend (`apps/web`):** React 18, Vite, Tailwind CSS, TanStack Query, Zustand, React Router 6, cmdk. Pure SPA.
- **Backend (`apps/api`):** Node 20+, Fastify 5, `fastify-type-provider-zod`, `@fastify/jwt`, bcryptjs. Listens on port 3001.
- **Database (`packages/db`):** PostgreSQL 16. Drizzle ORM + drizzle-kit. `postgres.js` driver.
- **Shared (`packages/shared`):** Zod schemas + pure parser — consumed by both web and api. **This is the single source of truth for data contracts.**
- **Language:** TypeScript strict, `noUncheckedIndexedAccess`, ESM everywhere (`"type": "module"` in every package).

### Request flow

1. Web client stores a JWT in `apps/web/src/store/auth.ts` (Zustand). Token is persisted to `localStorage` under `momentum-auth`.
2. All API calls go through `apps/web/src/lib/api.ts` → `apiFetch` helper, which attaches `Authorization: Bearer <token>`.
3. TanStack Query is the only mechanism for server-state fetching/mutation in the web app. All hooks live in `apps/web/src/api/hooks.ts` (single file, ~800 lines — intentional).
4. The API validates every body/query/param with a Zod schema via `fastify-type-provider-zod`. Every route also declares a Zod `response` schema, so responses are type-checked on the way out.
5. The API hook `preHandler: app.authenticate` gates every route under `/auth/*` and every protected route. `/auth/register`, `/auth/login`, `/health` are the only unauthenticated endpoints.

---

## 3. Repo layout

```
apps/
  web/                         React + Vite SPA (@momentum/web)
    src/
      api/hooks.ts             All TanStack Query hooks (single file)
      components/              Reusable UI (task cards, parking cards, modals, …)
        brands/                Brand-detail components (subdirectory)
      hooks/                   useGlobalShortcuts, useKeyboardController,
                               useBrandHealth, useSmartTextarea, useReleaseNotesPrompt
      layout/                  AppShell, Sidebar, TasksLayout
      lib/                     api client, date utils, formatters, queryClient, releaseNotes
      modals/                  Command palette, Plan My Day, EOD Review, Weekly Stats,
                               Shortcuts, Release Notes, Role Picker, Import Confirm
      pages/                   TodayPage, BacklogPage, ParkingsPage, BrandsPage,
                               LoginPage, RegisterPage, FirstRunWizard
      store/                   Zustand stores: auth.ts, ui.ts
      test/                    Vitest setup
      App.tsx                  Router
      main.tsx                 Entry
      index.css                Global CSS + theme tokens + m-* utilities

  api/                         Fastify HTTP API (@momentum/api)
    src/
      routes/                  One file per resource (see § 5)
      services/                tldv client, Google Sheets client, meeting scorer,
                               OpenAI extraction + dedup
      plugins/                 auth.ts (JWT), error-handler.ts
      test/mock-db.ts          Test harness used by every route test
      db.ts                    Drizzle client singleton
      env.ts                   Zod-validated env schema
      errors.ts                badRequest/notFound/etc. helpers
      mappers.ts               DB row → shared-schema object mappers
      index.ts                 Fastify bootstrap + route registration

packages/
  shared/                      Zod schemas + quick-add parser (@momentum/shared)
    src/
      schemas.ts               All Zod schemas + TS type exports
      parser.ts                parseQuickAdd + resolveDateToken + toLocalIsoDate
      index.ts                 Barrel
  db/                          Drizzle schema + migrations (@momentum/db)
    drizzle/                   SQL migration files (0000 … 0004)
    src/
      schema.ts                All pgTable definitions
      index.ts                 Barrel export
      migrate.ts               Migration runner script

docs/
  CLAUDE-CODE-PROMPT.md        Original product spec (v1)
  KEYBOARD-SHORTCUTS-REFERENCE.md
  MOMENTUM-BRANDS-FEATURE-SPEC.md
  BRANDS-ENGINEERING-TASKS.md
  MOMENTUM-TLDV-SYNC-SPEC.md
  TLDV-SYNC-ENGINEERING-TASKS.md
  MOMENTUM-FEATURE-REQUESTS-SPEC.md
  FEATURE-REQUESTS-TASKS.md
  TODO.md                      Living backlog of deferred ideas
  MOMENTUM-TECHNICAL-SPEC.md   (this file)
```

---

## 4. Data model

Source: `packages/db/src/schema.ts`. All tables live in the default `public` schema.

### Enums

| Enum | Values |
|---|---|
| `priority` | `high`, `medium`, `low` |
| `task_status` | `todo`, `in_progress`, `done` |
| `task_column` | `up_next`, `in_progress`, `done` |
| `theme` | `dark`, `light` |
| `parking_status` | `open`, `discussed`, `archived` |
| `brand_status` | `active`, `importing`, `import_failed` |
| `brand_action_status` | `open`, `done` |
| `meeting_source` | `manual`, `recording_sync` |
| `feature_request_sync_status` | `synced`, `pending`, `error` |

### Tables

#### `users`
`id uuid pk`, `email text unique`, `password_hash text`, `created_at timestamptz`.

#### `user_settings` (1:1 with users)
`user_id uuid pk fk→users`, `daily_capacity_minutes int = 480`, `theme theme = dark`, `user_name text`, `last_export_date timestamptz null`, `onboarded bool = false`.

#### `roles`
`id uuid pk`, `user_id fk→users`, `name text`, `color text = '#4F8EF7'` (hex), `position int = 0`, `created_at`.
Indexed on `user_id`. Role palette in `ROLE_COLOR_PALETTE` (shared).

#### `tasks`
`id`, `user_id`, `title text`, `role_id uuid null fk→roles ON DELETE SET NULL`, `priority priority = medium`, `estimate_minutes int null`, `actual_minutes int null`, `status task_status = todo`, `column task_column = up_next`, `scheduled_date date null`, `created_at`, `started_at timestamptz null`, `completed_at timestamptz null`.
Indexed on `(user_id)`, `(user_id, scheduled_date)`, `(user_id, status)`.
**Invariant:** an in-progress task has at most 2 per user (enforced by API, see § 5.4). `actual_minutes` is computed on `/complete` as `max(1, round((now - started_at) / 60s))` if `started_at` is set.

#### `daily_logs`
Unique `(user_id, date)`. Stores per-day summary: `tasks_planned`, `tasks_completed`, `total_estimated_minutes`, `total_actual_minutes`, `journal_entry text(4000) null`, `completion_rate real 0..1`.

#### `parkings`
`id`, `user_id`, `title`, `notes text(10_000) null`, `outcome text(10_000) null`, `target_date date null`, `role_id null fk→roles`, `priority priority = medium`, `status parking_status = open`, `created_at`, `discussed_at timestamptz null`.
Indexed on `(user_id)`, `(user_id, target_date)`, `(user_id, status)`.

#### `brands`
`id`, `user_id`, `name`, `goals text(10_000) null`, `success_definition text(10_000) null`, `custom_fields jsonb = '{}'`, `sync_config jsonb null`, `status brand_status = active`, `import_error text null`, `imported_from text null`, `raw_import_content text null`, `feature_requests_config jsonb null`, `created_at`, `updated_at`.

- `sync_config` shape: `{ matchRules: { stakeholderEmails[], titleKeywords[], meetingType: 'external'|'internal'|'both', syncWindowDays: number }, syncedMeetingIds: string[], lastSyncedAt: iso|null, lastSyncedMeetingDate: string|null }`.
- `feature_requests_config` shape: `{ sheetId, sheetGid, sheetUrl, connected: bool, lastSyncedAt: iso|null, columnMapping: { date, request, response, resolved } }`.
- `custom_fields` is an explicit extension point for v2 metadata (revenue, deal stage, renewal dates) without a schema change.

#### `brand_stakeholders`
`id`, `brand_id fk→brands ON DELETE CASCADE`, `user_id`, `name`, `email text null`, `role text null`, `notes text null`.

#### `brand_meetings`
`id`, `brand_id cascade`, `user_id`, `date`, `title`, `attendees text[]`, `summary text(10_000) null`, `raw_notes text(100_000)`, `decisions text[]`, `source meeting_source = manual`, `external_meeting_id text null`, `recording_url text null`.
Indexed on `(brand_id)`, `(brand_id, date)`.
**Merge rule:** on recording sync, if a manual meeting already exists for the same `(brand_id, date)`, the sync merges into it (concat rawNotes with `\n\n---\n\n### {title} (from recording)\n\n`, dedupe attendees, concat decisions, keep existing `recording_url` if present else use tldv url, concat `external_meeting_id` as comma-separated list).

#### `brand_action_items`
`id`, `brand_id cascade`, `meeting_id null fk→brand_meetings SET NULL`, `user_id`, `text text(2000)`, `status brand_action_status = open`, `owner text null`, `due_date date null`, `linked_task_id uuid null fk→tasks SET NULL`, `created_at`, `completed_at timestamptz null`.
**Bidirectional sync:** completing `tasks.id === X` cascades `brand_action_items.status = 'done'` where `linked_task_id = X`. Completing a brand action item does NOT currently cascade to tasks (asymmetric — see § 10.1).

#### `brand_feature_requests`
`id`, `brand_id cascade`, `user_id`, `sheet_row_index int null`, `date text` (not a date column — flexible string), `request text(10_000)`, `response text(10_000) null`, `resolved bool = false`, `sync_status feature_request_sync_status = pending`, `created_at`, `updated_at`.
`sheet_row_index` is the 0-indexed row in the source sheet; becomes `null` when the row is deleted upstream or the sheet is disconnected.

### Relationships summary

```
users 1──* roles
users 1──* tasks ──? roles
users 1──* parkings ──? roles
users 1──* daily_logs
users 1──1 user_settings
users 1──* brands
  brands 1──* brand_stakeholders
  brands 1──* brand_meetings
    brand_meetings 1──* brand_action_items
  brands 1──* brand_action_items ──? tasks  (linked_task_id, ON DELETE SET NULL)
  brands 1──* brand_feature_requests
```

### Migration conventions

- `pnpm db:generate` creates SQL under `packages/db/drizzle/` from schema changes.
- `pnpm db:migrate` applies them.
- Journal at `packages/db/drizzle/meta/_journal.json` tracks migration order.
- Current migrations: `0000_initial` … `0004_tan_landau` (feature requests).

---

## 5. API surface

Registered in `apps/api/src/index.ts`. All routes below require a valid JWT (`preHandler: app.authenticate`) unless noted. All request/response schemas are defined in `packages/shared/src/schemas.ts` and referenced here by name.

### 5.1 Auth — `routes/auth.ts`
- `POST /auth/register` — `registerInputSchema` → `authResponseSchema`. Unauthenticated.
- `POST /auth/login` — `loginInputSchema` → `authResponseSchema`. Unauthenticated.
- `GET /auth/me` — → `authUserSchema`. JWT required.
- `GET /health` — unauth, returns `{ ok: true }`.

JWT: signed with `env.JWT_SECRET` (min 16 chars), `expiresIn = env.JWT_EXPIRES_IN` (default `7d`), payload `{ sub: userId }`. Decoded in `plugins/auth.ts` and exposed as `req.userId`.

### 5.2 Settings — `routes/settings.ts`
- `GET /settings` — returns `userSettingsSchema`. Lazily bootstraps a settings row if missing.
- `PUT /settings` — `updateSettingsInputSchema` (partial: `dailyCapacityMinutes`, `theme`, `userName`, `onboarded`).

### 5.3 Roles — `routes/roles.ts`
- `GET /roles` — ordered by `position`.
- `POST /roles` — `createRoleInputSchema`. Auto-assigns next `position`.
- `DELETE /roles/:id` — cascades tasks/parkings' `role_id` to null (`ON DELETE SET NULL`).

### 5.4 Tasks — `routes/tasks.ts`
- `GET /tasks?date=&roleId=&status=` — filtered, ordered by `created_at DESC`.
- `POST /tasks` — defaults `scheduledDate` to today (local ISO).
- `PATCH /tasks/:id` — any of `title/roleId/priority/estimateMinutes/status/column/scheduledDate/actualMinutes`.
- `DELETE /tasks/:id`.
- `POST /tasks/:id/start` — enforces `MAX_IN_PROGRESS = 2` (returns 400 "Max 2 tasks in progress…"); sets `started_at = COALESCE(started_at, NOW())`.
- `POST /tasks/:id/pause` — back to `todo / up_next`.
- `POST /tasks/:id/complete` — computes `actual_minutes` from `started_at`; cascades any linked `brand_action_items` to `done`.
- `POST /tasks/:id/defer` — optional `{ scheduledDate }` body; defaults to tomorrow.

### 5.5 Parkings — `routes/parkings.ts`
- `GET /parkings?status=&targetDate=&roleId=`
- `POST /parkings` (`createParkingInputSchema`)
- `PATCH /parkings/:id` (`updateParkingInputSchema`)
- `DELETE /parkings/:id`
- `POST /parkings/:id/discuss` — marks `discussed`, sets `discussed_at`.
- `POST /parkings/:id/reopen` — back to `open`.

### 5.6 Daily logs + stats — `routes/daily-logs.ts`, `routes/stats.ts`
- `GET /daily-logs?limit=` (default 30).
- `POST /daily-logs` — upsert by `(user_id, date)`; body supports `journalEntry`. Triggers recompute of `tasksPlanned`, `tasksCompleted`, `totalEstimatedMinutes`, `totalActualMinutes`, `completionRate` from tasks on that date.
- `GET /stats/weekly` — `weeklyStatsSchema`: last 7 days + completion rate per day, `mostActiveRoleId`, `estimationAccuracy` (ratio), `streak` (consecutive days with ≥1 completed task).

### 5.7 Brands — `routes/brands.ts`, `routes/brand-import.ts`
- `GET /brands` — list (active + importing + import_failed).
- `GET /brands/:id` — detail. **Web hook polls every 3s while `status='importing'`.**
- `POST /brands` (`createBrandInputSchema`) — creates active brand.
- `PATCH /brands/:id` (`updateBrandInputSchema`).
- `DELETE /brands/:id` — cascades stakeholders/meetings/action_items/feature_requests.
- `POST /brands/import` (`brandImportInputSchema` = `{ fileName, fileContent }`) — returns stub brand with `status='importing'`; kicks off `processImportAsync` in the background. Truncates content to last 50k chars; uses `gpt-4o-mini` with `response_format: json_object`, `temperature: 0.2`. Populates `name/goals/successDefinition/brandStakeholders/brandMeetings/brandActionItems`. On failure sets `status='import_failed'` with `importError`.

### 5.8 Brand stakeholders — `routes/brand-stakeholders.ts`
- `GET /brands/:brandId/stakeholders`
- `POST /brands/:brandId/stakeholders`
- `PATCH /brands/:brandId/stakeholders/:id`
- `DELETE /brands/:brandId/stakeholders/:id`

### 5.9 Brand meetings — `routes/brand-meetings.ts`
- `GET /brands/:brandId/meetings`
- `POST /brands/:brandId/meetings` — creates with `source='manual'`. Lines starting with `→` in `rawNotes` are auto-extracted as `brand_action_items` (by `apps/web/src/lib/extractActionItems.ts`, but the extraction is done client-side before POST).
- `PATCH`, `DELETE` — straightforward.

### 5.10 Brand action items — `routes/brand-action-items.ts`
- `GET /brands/:brandId/action-items?status=`
- `POST` (`createBrandActionItemInputSchema`)
- `PATCH` (`updateBrandActionItemInputSchema`)
- `DELETE`
- `POST /brands/:brandId/action-items/:id/send-to-today` — creates a new `tasks` row, links both ways (`brand_action_items.linked_task_id` ← task.id). Response: `{ actionItem, task }`.
- `POST /brands/:brandId/action-items/:id/complete` — marks done, sets `completed_at`. (Does NOT currently complete the linked task — asymmetric.)

### 5.11 Brand sync (tldv) — `routes/brand-sync.ts`

**Required env:** `TLDV_API_KEY` (+ `OPENAI_API_KEY` for extraction/dedup).

- `POST /brands/:brandId/sync/candidates` → `syncCandidatesResponseSchema`. Fetches up to 5 pages × 50 meetings from tldv in the date window (`lastSyncedMeetingDate` → now, or `syncWindowDays` back if unset). Merges stakeholder emails into rules. Scores each meeting via `services/meeting-scorer.ts`. Skips already-synced IDs.
- `POST /brands/:brandId/sync/lookup` — body `{ meetingRef: string }` (tldv URL or raw ID). Returns a single `syncCandidateSchema` with `score: 0, reasons: ['Manual link'], confidence: 'high'`.
- `POST /brands/:brandId/sync/confirm` — body `{ meetingIds: string[] }`. For each: fetches meeting + transcript + highlights; runs OpenAI extraction if transcript present; merges into same-day manual note if exists, else creates new; dedupes action items against existing open items via LLM; creates/updates/skips per LLM verdict. Returns `{ imported, pendingTranscripts, errors, actionItemStats: { extracted, created, skipped, updated } }`. Breaks loop on tldv 429.
- `PATCH /brands/:brandId/sync/config` — `{ matchRules: Partial<SyncMatchRules> }`.

### 5.12 Brand feature requests — `routes/brand-feature-requests.ts`, `routes/brand-feature-request-sync.ts`

**Required env for sync operations:** `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string; sheet must be shared with the service account's `client_email`).

CRUD:
- `GET /brands/:brandId/feature-requests?resolved=&search=` — `resolved` is `'true'|'false'` string, `search` is substring match over `request + response`.
- `POST /brands/:brandId/feature-requests` (`createBrandFeatureRequestInputSchema`). Sets `syncStatus='pending'`.
- `PATCH /brands/:brandId/feature-requests/:id` (`updateBrandFeatureRequestInputSchema`). Sets `syncStatus='pending'` on change. **On PATCH, if a sheet is connected, the route auto-pushes the change immediately (best-effort; marks `error` on failure).**
- `DELETE` — deletes locally and, if connected and `sheetRowIndex` set, deletes the row from the sheet.
- `POST /brands/:brandId/feature-requests/:id/convert-to-action` — creates a `brand_action_items` row with text copied from the request, sets `resolved=true` on the feature request.

Sheet sync:
- `POST /brands/:brandId/feature-requests/connect-sheet` — `{ sheetUrl, sheetGid?, standardize: bool=true }`. Parses URL, reads sheet, analyzes columns via regex heuristics in `services/google-sheets.ts` (`COLUMN_PATTERNS` for Date/Request/Response/Resolved). If `standardize`: rewrites headers to canonical `['Date','Request','Response','Resolved']`, writes all parsed rows back into columns 0–3, applies formatting (column widths, wrap, checkbox validation — catches failure for table-typed sheets). Imports all rows. Response: `{ config, imported, headers: { original, mapped } }`.
- `POST /brands/:brandId/feature-requests/sync/pull` — read sheet → diff by `sheetRowIndex` against DB. Creates / updates / marks deleted (sets `sheet_row_index=null, syncStatus=pending`). Returns counts.
- `POST /brands/:brandId/feature-requests/sync/push` — pushes all `syncStatus='pending'` rows; upserts by `sheetRowIndex` or appends. Marks `synced` or `error` per row.
- `POST /brands/:brandId/feature-requests/disconnect-sheet` — clears config, nulls all `sheet_row_index`, marks all rows `pending`.

### 5.13 Data export/import — `routes/data.ts`
- `GET /export` — returns `exportFileSchema` (current version `'1.3'`). Includes users' settings, roles, tasks, daily_logs, parkings, brands (+ stakeholders, meetings, action items, feature requests). Updates `user_settings.last_export_date`.
- `POST /import` — body `{ mode: 'replace'|'merge', file: ExportFile }`. Replace wipes user's data. Merge inserts new rows only. Older export file versions (`1.0`–`1.2`) are backward-compatible.

### 5.14 Error handling — `plugins/error-handler.ts`
- Zod validation errors → `400` with flattened field errors.
- `badRequest(msg)` / `notFound(msg)` helpers in `errors.ts` throw tagged errors rendered as `{ statusCode, message }`.
- `preSerialization` strips internal fields.

---

## 6. Frontend architecture

### 6.1 Routing (`App.tsx`)

```
/login, /register                    — unauthenticated
/                                    → <AppShell>
  /                                  → <TasksLayout> → <TodayPage>   (index)
  /backlog                           → <TasksLayout> → <BacklogPage>
  /parkings                          → <ParkingsPage>
  /brands                            → <BrandsPage> (list + empty detail)
  /brands/:id                        → <BrandsPage> (list + selected detail)
```

`<Protected>` redirects to `/login` if no JWT. `<AppShell>` wraps the sidebar + main area, registers global shortcuts, mounts toast stack + modal root, and handles first-run redirect to `FirstRunWizard` if `user_settings.onboarded === false`.

### 6.2 State management

**Zustand (`store/`)**
- `auth.ts` — `{ token, user, setAuth, clearAuth }` persisted to `localStorage`.
- `ui.ts` — `{ activeModal, roleFilter, selectedTaskId, focusedColumn, selectedParkingId, toasts, pendingImport }`. Modals are identified by a `ModalKind` enum: `null | 'command-palette' | 'plan-my-day' | 'end-of-day' | 'weekly-stats' | 'shortcuts' | 'import-confirm' | 'role-picker' | 'release-notes'`.

**TanStack Query**
- Query client in `lib/queryClient.ts`.
- All hooks in `api/hooks.ts` (single file — intentional).
- Standard pattern: one `useX` read hook per resource, one mutation per action, `onSuccess` invalidates the matching query key.
- **Polling:** `useBrand(id)` polls every 3s while `status==='importing'` (`refetchInterval` on the query).
- **Query key shape:** top-level arrays: `['brands']`, `['brands', id]`, `['brands', id, 'stakeholders']`, `['brands', id, 'meetings']`, `['brands', id, 'action-items', params]`, `['brands', id, 'feature-requests', params]`, `['tasks', params]`, `['parkings', params]`, `['roles']`, `['settings']`, `['daily-logs', limit]`, `['weekly-stats']`, `['me', token]`.

### 6.3 Pages

- **`TodayPage`** — three-column kanban (`up_next` / `in_progress` / `done`), task input bar, time-budget bar, role-filter bar, data-sync badge. Uses `useKeyboardController` for j/k/h/l navigation + task actions.
- **`BacklogPage`** — flat list of tasks not scheduled for today, with "→ Today" button per row. No keyboard navigation yet (deferred, see `docs/TODO.md`).
- **`ParkingsPage`** — flat list grouped by day (Today / Tomorrow / named future dates / Unscheduled). Uses `useKeyboardController` in parkings mode. Parking input bar at top.
- **`BrandsPage`** — two-pane: `BrandListRail` on the left, `BrandDetailView` on the right. Detail has a `BrandTabBar` with tabs: Overview (`1`), Work (`2`), Feature Requests (`3`, alias `f`).
- **`FirstRunWizard`** — 3-step flow: name → pick roles (from palette) → daily capacity. On submit, writes `user_settings.onboarded=true`.

### 6.4 Brand detail structure (`components/brands/`)

```
<BrandDetailView>
├── <BrandDetailHeader>        name (editable), HealthPill, "Sync Recordings" button
├── <BrandTabBar>              Overview | Work | Feature Requests
├── <OverviewTab>
│   ├── NorthStar              goals, success definition, StakeholderBadge grid
│   ├── Pulse                  open action items count, meeting recency, feature request summary
│   └── RawContextSection      (if rawImportContent) collapsed raw notes
├── <WorkTab>
│   ├── ActionItemsSection     filter open/done, create, edit, send-to-today
│   └── MeetingsSection        list of meetings, MeetingNoteModal for create/edit
└── <FeatureRequestsTab>
    ├── ConnectSheetModal      (if not connected) prompt to connect Google Sheet
    ├── Filter bar             All / Open / Resolved + search
    ├── FeatureRequestRow[]    inline-editable cells
    └── Sync controls          Pull, Push, Disconnect
```

Other components:
- `SyncReviewModal` + `SyncCandidateRow` — recording sync review.
- `SyncSettingsPanel` — matching rules.
- `ImportBrandModal` — file upload, kicks off `POST /brands/import`.

### 6.5 Modals (`modals/`)

`<ModalRoot>` renders exactly one modal at a time based on `useUiStore().activeModal`.

| Modal | Opens via | Purpose |
|---|---|---|
| `CommandPaletteModal` | ⌘K | cmdk palette — navigation + actions |
| `PlanMyDayModal` | ⌘P | Select unscheduled tasks for today, sets `scheduled_date` |
| `EndOfDayModal` | ⌘R | Journal entry + auto-computes `daily_logs` for today |
| `WeeklyStatsModal` | ⌘W | Renders `weeklyStatsSchema` |
| `ShortcutsModal` | ? | Full keyboard shortcut reference (LOAD-BEARING — see CLAUDE.md) |
| `ReleaseNotesModal` | auto + Cmd+K → Help | "What's new" — source is `lib/releaseNotes.ts` |
| `RolePickerModal` | `r` on selected task/parking | Pick role |
| `ImportConfirmModal` | after file pick in ⌘I flow | Confirm replace/merge |

All modals are portal-rendered (`createPortal(..., document.body)`) when they live inside page components — a feedback memory entry documents why.

### 6.6 Key custom hooks (`hooks/`)

- **`useGlobalShortcuts`** — registered once in `AppShell`. Capture-phase `keydown` listener that owns every cross-view shortcut: `/`, `Esc`, `?`, `⌘K/P/R/W/E/I/B`, `g`-prefix (`gt/gl/gp/gb`), bracket cycle `[` `]`, role filter `0`–`9`. Consumes events so page-level handlers never double-fire (e.g. `g p` doesn't also cycle task priority).
- **`useKeyboardController`** — page-scoped handler for task/parking navigation + actions. Lives in `TodayPage` and `ParkingsPage`. Ignores events if focus is in an input/textarea/contenteditable or if any modal is open. See § 7.
- **`useBrandHealth(brand, meetings, actionItems)`** — computes green/amber/red dot. Rules: red if >3 open overdue action items OR no meeting in 30 days with open items; amber if quiet (no meeting in 14 days); else green.
- **`useSmartTextarea`** — input-bar helpers: `/todo` shortcut that inserts `→ `, auto-bullet on Enter after `- ` / `* ` / `→ `, Tab-indent in the meeting-notes textarea.
- **`useReleaseNotesPrompt`** — compares `LATEST_VERSION` from `lib/releaseNotes.ts` against `localStorage.momentum-seen-release`; opens `release-notes` modal once per new release.

### 6.7 Shared libs (`lib/`)

- `api.ts` — `apiFetch<T>(path, { method, body, token, query })` helper.
- `date.ts` — `toLocalIsoDate`, `parseIsoDate`, `formatRelativeDay`, etc.
- `format.ts` — `formatMinutes` (→ "1h 15m"), `formatCompletionRate`, etc.
- `extractActionItems.ts` — parses `rawNotes` and returns action-item strings from lines starting with `→`. Used on the client before `POST /brands/:id/meetings`.
- `releaseNotes.ts` — the `RELEASE_NOTES` array (reverse-chronological). `LATEST_VERSION` is derived from `RELEASE_NOTES[0].version`. `compareVersions(a, b)` does dotted-int comparison.
- `queryClient.ts` — TanStack Query client singleton.

---

## 7. Keyboard shortcut architecture

This is one of the defining parts of the product and a common source of regressions. Two layers:

### 7.1 Global layer — `hooks/useGlobalShortcuts.ts`

- Registered exactly once, in `AppShell`.
- Uses `window.addEventListener('keydown', handler, { capture: true })`.
- Calls `e.preventDefault()` **and** `e.stopPropagation()` on every consumed key — this prevents bubble-phase page handlers from double-firing. **This is how `g p` (go to Parkings) doesn't also trigger `p` (cycle priority) on the selected task.**
- Owns the following bindings:
  - `/` — focus first `[data-task-input="true"]` input.
  - `Esc` — blur focused input → else close active modal.
  - `?` — open `shortcuts` modal.
  - `⌘K` command palette, `⌘P` plan-my-day, `⌘R` EOD review, `⌘W` weekly stats.
  - `⌘E` dispatches `momentum:export` event; `⌘I` dispatches `momentum:import`. `DataSync` component listens.
  - `⌘B` navigate to `/brands`.
  - `g`-prefix (1500 ms timeout) → `gt` `/`, `gl` `/backlog`, `gp` `/parkings`, `gb` `/brands`. Double `g` cancels.
  - `]` / `[` — cycle through `['/', '/backlog', '/parkings', '/brands']`.
  - `0`–`9` — role filter (`0` = clear, `1`–`9` index into `useRoles().data`).

### 7.2 Page-scoped layer — `hooks/useKeyboardController.ts`

- Uses regular bubble-phase listener.
- **Bails out if** `e.defaultPrevented` is true (i.e. global already consumed) OR focus is in an input OR a modal is open.
- Path-aware: on `/parkings` uses parking-list flat navigation; on `/` uses Today kanban navigation; otherwise no-op.
- Today bindings:
  - `j/k/↓/↑` — move within active column.
  - `h/l/←/→` — switch active column.
  - `Enter` — start (if todo). `Space` — complete (if not done).
  - `e` — edit inline (title only). `r` — open role picker. `p` — cycle priority low→med→high.
  - `d` — defer to tomorrow. `Delete`/`Backspace` — delete with 5s undo toast.
- Parkings bindings:
  - `j/k` — navigate. `Enter` — expand/collapse detail drawer.
  - `Space` — mark discussed. `e` — edit title inline. `r` — role picker.
  - `p` — cycle priority. `d` — defer to next day (or +1 from `targetDate`).
  - `Delete` — delete with undo.

### 7.3 Modal-internal shortcuts

Each modal registers its own `keydown` listener when mounted:
- `CommandPaletteModal` — cmdk default + ⌘Enter to run.
- `SyncReviewModal` — `j/k` navigate, `Enter` toggle, `⌘Enter` confirm, `Esc` close.
- `RolePickerModal` — number keys 1–9, Enter, Esc.
- `FeatureRequestsTab` has its own page-scoped handler with `n/j/k/Space/r`.
- `BrandDetailView` has tab-switching handlers for `1`/`2`/`3`/`f`/`s`/`n`/`a`.

### 7.4 The `ShortcutsModal` invariant

`apps/web/src/modals/ShortcutsModal.tsx` is load-bearing user-facing documentation. Per `CLAUDE.md`: **any change to a keydown handler MUST update the corresponding `SECTIONS` entry in the same commit.** Sections: Global / View navigation / Today navigation / Task actions / Parkings / Brands / Feature Requests / Sync Review.

---

## 8. Theme system

Source: `apps/web/src/index.css`.

- Two themes: `dark` (default), `light`. Stored in `user_settings.theme`; toggle in sidebar.
- Implemented as CSS custom properties under `:root[data-theme="dark"]` / `[data-theme="light"]`. Examples: `--m-bg`, `--m-surface`, `--m-fg`, `--m-fg-muted`, `--m-fg-tertiary`, `--m-fg-dim`, `--m-border`, `--m-border-subtle`, `--m-border-strong`, `--m-kbd-from/to`, `--m-glow-accent`, `--m-glow-secondary`.
- Tailwind is configured in `apps/web/tailwind.config.js` with an `m` color namespace (`m.bg`, `m.surface`, etc.). **Every `bg-m-surface`, `text-m-fg`, `border-m-border` utility must be manually declared in `index.css @layer utilities` to work around a Tailwind JIT bug with CSS-variable colors** (documented in `feedback_tailwind_css_var_bug.md`).
- **Gotchas:**
  - Do not use `@apply` with `m-*` color classes inside `@layer base` — PostCSS crashes. Use raw CSS instead.
  - `border-m-border` can't override side-specific borders (`border-l-*`) due to specificity; inline style is the workaround on parking priority stripes.
- **Never** use raw `bg-zinc-*` / `text-zinc-*` in app code. Semantic tokens only.

---

## 9. Feature deep-dives

### 9.1 Quick-add parser

File: `packages/shared/src/parser.ts` (pure, both client and server usable).

Grammar (order-agnostic):
- `~30m` / `~2h` → `estimateMinutes`.
- `#product` → `roleTag` (resolves to `role_id` by case-insensitive name match, client-side).
- `!h` / `!m` / `!l` → `priority: high|medium|low`.
- `+tomorrow` / `+mon` / `+thu` / `+today` / `+yesterday` → `dateToken` → resolved to `scheduled_date` via `resolveDateToken(token, now)`.

Example: `"Buy domain ~30m #product !h +tomorrow"`. Unknown tokens stay in `title`.

### 9.2 Action-item extraction from meeting notes

Client-side: `apps/web/src/lib/extractActionItems.ts`. Scans `rawNotes` line-by-line; any line starting with `→ ` (arrow + space) is extracted. The web client pre-extracts and POSTs `brand_action_items` separately after creating the meeting — the API does not scan `rawNotes`. This means editing `rawNotes` does NOT re-extract; only new meetings trigger extraction.

### 9.3 Brand import flow

1. Client reads file → `POST /brands/import { fileName, fileContent }`.
2. Server creates brand row with `status='importing'`, returns stub.
3. Server spawns `processImportAsync` (unawaited). Calls OpenAI `gpt-4o-mini` with the hardcoded system prompt in `brand-import.ts`; `temperature: 0.2`, `response_format: json_object`.
4. Populates brand fields, stakeholders (dedup by lowercase name), meetings, action items.
5. On success: `status='active'`. On failure: `status='import_failed'` with `import_error` message.
6. The UI `useBrand(id)` polls every 3s while `status='importing'` and auto-navigates to the brand detail when done.

### 9.4 Meeting recording sync flow (tldv)

1. User clicks "Sync Recordings" on a brand → `useFetchSyncCandidates` → `POST /sync/candidates`.
2. Server: auto-injects stakeholder emails into `matchRules.stakeholderEmails`. Fetches pages 1–5 (max 250 meetings) from tldv over date window. Runs `scoreMeeting` per meeting:
   - +50 per stakeholder email match (any invitee or organizer).
   - +30 per title keyword match.
   - `hasStakeholderMatch` → `likely` (sorted desc by score).
   - Else if score ≥ 30 → `possible`.
   - Already-synced IDs filtered out (`score = -1000`).
3. `SyncReviewModal` renders likely + possible. User ticks; ⌘Enter confirms.
4. `POST /sync/confirm { meetingIds }`: per meeting, fetches detail + transcript + highlights. If transcript empty: creates note with summary "Transcript still processing…", increments `pendingTranscripts` counter.
5. If OpenAI key + transcript: calls `extractMeetingContent` (`gpt-4o-mini`, `temperature: 0.2`, truncates transcript to 80k chars via first-30-min + last-15-min middle-out).
6. Merge rule: if `(brand_id, date)` already has a meeting, merge (see § 4 `brand_meetings`). Else create with `source='recording_sync'`.
7. Action-item dedup: if existing open items > 0, calls `deduplicateActionItems` LLM with up to 100 existing items. Per extracted item, LLM emits `create | skip | update` verdict. Unmatched indices default to `create`. On dedup failure, falls back to insert-all.
8. Update `brand.syncConfig.syncedMeetingIds` + `lastSyncedAt` + `lastSyncedMeetingDate`.
9. Returns `actionItemStats: { extracted, created, skipped, updated }`.

**Manual link:** `POST /sync/lookup { meetingRef }` parses a tldv URL (`/meetings/:id`) or raw ID, returns a candidate with `confidence='high'`. The same `/sync/confirm` path then imports it.

### 9.5 Feature Requests — Google Sheets two-way sync

**Connection:**
1. User pastes sheet URL. Server parses `/spreadsheets/d/:id` and `gid=` parameter.
2. Reads sheet, runs `analyzeColumns` with heuristic regexes (`/\b(date|requested|submitted)\b/i` etc.) over the header row. If all four columns (Date, Request, Response, Resolved) matched → mapping saved. Else 400.
3. If `standardize=true`: rewrites headers to canonical `['Date','Request','Response','Resolved']`, writes all parsed rows into columns 0–3, applies formatting (column widths 100/400/400/80 px, wrap strategy, checkbox validation). Dates pushed as native Sheets serial-date values with `pattern: 'yyyy/mm/dd'`. Resolved pushed as native booleans.
4. Imports all rows into `brand_feature_requests` with `sheetRowIndex`, `syncStatus='synced'`.

**Pull (`/sync/pull`):** reads sheet, diffs by `sheetRowIndex`. Creates new local rows for new sheet rows, updates changed rows, marks removed rows with `sheetRowIndex=null, syncStatus=pending`.

**Push (`/sync/push`):** iterates `syncStatus='pending'` rows. If `sheetRowIndex` set → overwrite row; else → `appendRow` (finds last non-empty data row, writes to `lastDataRow + 1`, returns new index). Marks `synced` or `error`.

**Auto-push:** every `PATCH /feature-requests/:id` pushes the change immediately if connected (best-effort, independent of explicit push).

**Convert to action:** creates a `brand_action_items` with `text = feature_request.request`, sets `resolved=true`. The sheet is updated on next push.

**Gotchas documented in memory:**
- Dates in Sheets need native date values with `numberFormat: DATE, pattern: yyyy/mm/dd`, NOT strings with leading apostrophes.
- Must use `batchUpdate.updateCells` (not `values.update`) to set native booleans + date serials simultaneously.
- Table-typed sheets reject `setDataValidation` for the Resolved column → wrap in try/catch and skip gracefully.

### 9.6 Release notes sync

`apps/web/src/lib/releaseNotes.ts` is the single source of truth. Every user-visible change appends a new entry:
- `version` (semver: minor for new feature, patch for bugfix/polish).
- `date` (YYYY-MM-DD).
- `headline`, `summary`, `items[]` with `title`, `description`, optional `shortcuts: string[]`, optional `howTo`.
- `LATEST_VERSION` is derived from `RELEASE_NOTES[0].version`.
- `localStorage.momentum-seen-release` stores the last version the user saw; `useReleaseNotesPrompt` opens the modal if `compareVersions(LATEST, seen) > 0`.

Per `CLAUDE.md`, TODO.md is updated alongside the release notes entry.

---

## 10. Integration touchpoints

### 10.1 OpenAI

- Model: `gpt-4o-mini` everywhere.
- Response format: `{ type: 'json_object' }`.
- Temperature: `0.2`.
- Used in:
  - `brand-import.ts` — brand extraction from raw notes. `max_tokens: 16_384`.
  - `services/meeting-extraction.ts → extractMeetingContent` — meeting summary + action items + decisions + attendee mapping. `max_tokens: 4096`.
  - `services/meeting-extraction.ts → deduplicateActionItems` — LLM-based action-item dedup. `max_tokens: 4096`, capped at 100 existing items.
- All three share a pattern: full system prompt inlined as a string, user message is structured data, parse JSON via `JSON.parse`, validate minimally with `Array.isArray` guards.
- No retries; single attempt. On failure the code falls back gracefully (sync continues without extraction / dedup).
- Required env: `OPENAI_API_KEY`.

### 10.2 tldv

- Client: `apps/api/src/services/tldv.ts`. Base URL: `https://pasta.tldv.io/v1alpha1`. Auth: `x-api-key` header.
- Endpoints used: `GET /meetings`, `GET /meetings/:id`, `GET /meetings/:id/transcript`, `GET /meetings/:id/highlights`.
- Retry: 3 attempts with exponential backoff (1s base × 2^n). 5xx + 429 retried; 4xx (non-429) thrown immediately as `TldvApiError`.
- `normalizeDate` handles both verbose `"Wed Apr 15 2026 …"` from list endpoint and ISO `"2026-04-15T…"` from detail endpoint.
- Required env: `TLDV_API_KEY`.

### 10.3 Google Sheets

- Client: `apps/api/src/services/google-sheets.ts`. Uses `googleapis` Node SDK.
- Auth: service account JSON, scope `https://www.googleapis.com/auth/spreadsheets`. The sheet must be shared (Editor) with the service account's `client_email`.
- Key operations:
  - `getSheetName` — resolve GID → sheet title (needed for A1-notation reads).
  - `readSheet(id, gid)` — uses `FORMATTED_VALUE` render option so dates come back as strings.
  - `writeRow / writeAllRows` — uses `batchUpdate.updateCells` with native typed values (date serials, booleans, strings).
  - `appendRow` — manually finds `lastDataRow` by checking columns 0 and 1 (ignores column 3 because table formatting can make empty rows read as "FALSE").
  - `standardizeSheetFormatting` — column widths + wrap strategy (hard requirements) + checkbox validation (optional, wrapped in try/catch).
- Required env: `GOOGLE_SERVICE_ACCOUNT_KEY` (full JSON as a single-line string; the client `replace(/\n/g, '\\n')` normalizes embedded newlines).

---

## 11. Testing

- Every package uses Vitest. Turbo runs them via `pnpm test`.
- ~360+ tests across the repo.
- **Colocated:** `foo.ts` → `foo.test.ts`.
- **API route tests:** use `apps/api/src/test/mock-db.ts` to swap the real postgres client for an in-memory stub, and Fastify `.inject()` to exercise routes without a running server. Route tests assert business logic (state transitions, validation, cascades) — not wiring.
- **Schema tests (`packages/shared/src/schemas.test.ts`):** guarantee valid input parses and invalid input is rejected with expected errors.
- **Parser tests (`packages/shared/src/parser.test.ts`):** cover all quick-add tokens, weekday resolution, edge cases.
- **Web component tests:** `@testing-library/react` + `jsdom`. Smart-textarea, brand health, release-note logic have unit tests.
- **Date-dependent tests** use `vi.useFakeTimers()`.
- **CLAUDE.md mandate:** every code change that adds/modifies runtime logic must include tests in the same commit.

---

## 12. Environment variables

From `apps/api/src/env.ts` (validated at startup via Zod):

| Var | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | |
| `API_PORT` | no | `3001` | |
| `API_HOST` | no | `0.0.0.0` | |
| `DATABASE_URL` | **yes** | — | postgres connection string |
| `JWT_SECRET` | **yes (≥16 chars)** | — | |
| `JWT_EXPIRES_IN` | no | `7d` | |
| `CORS_ORIGIN` | no | `http://localhost:5173` | |
| `OPENAI_API_KEY` | no | — | brand import, meeting extraction, action-item dedup |
| `TLDV_API_KEY` | no | — | recording sync |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | no | — | feature-request sheet sync |

Web-only: `VITE_API_URL` (default `http://localhost:3001`).

The API reads the repo-root `.env` (two levels up from `src/`). Missing the file is the #1 new-contributor error.

---

## 13. Development conventions (from CLAUDE.md)

Rules that apply to every change:

1. **Data contract lives in `packages/shared`.** Mutate Zod schemas there first; both web and api import the derived types. Never duplicate shapes.
2. **Shortcuts modal stays in sync.** Any `keydown` change → same-commit update to `ShortcutsModal.tsx`.
3. **Release notes stay in sync.** Any user-visible change → same-commit prepend to `releaseNotes.ts`. Also update `docs/TODO.md` and `README.md` if setup/stack/top-level scripts changed.
4. **Tests in same commit** — no runtime change without tests.
5. **Global vs. page shortcuts.** Cross-view bindings go in `useGlobalShortcuts` (capture phase, stop propagation). Page-specific ones in `useKeyboardController`. Never duplicate.
6. **No auto-focus** on page-mount inputs (it swallows `g`-prefix bindings). Use `/` to focus intentionally.
7. **No `window.confirm`.** Use the in-app `confirm()` from `ConfirmProvider`.
8. **TypeScript strict.** `noUncheckedIndexedAccess` means `array[i]` is `T | undefined`. Guard or `!`-assert explicitly.
9. **ESM everywhere.** Relative imports end in `.ts` (API) or omitted (web/Vite).
10. **Hooks before early returns** — standard React rule. Placing a hook after a conditional `return` causes a render crash.
11. **Hand restart API** after env or dependency changes. `tsx watch` does not always pick them up.

---

## 14. Extensibility notes for future features

### 14.1 Where to add things

- **New table:** update `packages/db/src/schema.ts` → `pnpm db:generate` → review SQL → `pnpm db:migrate`. Add Zod schema + input schemas to `packages/shared/src/schemas.ts`. Add mapper in `apps/api/src/mappers.ts`.
- **New API route group:** create `apps/api/src/routes/foo.ts` exporting `FastifyPluginAsyncZod`. Register in `apps/api/src/index.ts`. Add `preHandler: app.authenticate`. Define schema with `schema: { body, params, querystring, response }` — all Zod.
- **New TanStack Query hook:** append to `apps/web/src/api/hooks.ts`. Use the `useToken()` pattern, pass `token` to `apiFetch`, invalidate relevant query keys on mutation success.
- **New page:** add to `App.tsx` under `<AppShell>` (or as standalone). Add to `VIEW_CYCLE` in `useGlobalShortcuts` if it should be reachable via `[`/`]` and a `g`-prefix key.
- **New modal:** add kind to `ModalKind` in `store/ui.ts`. Add render case in `ModalRoot`. Add shortcut in `useGlobalShortcuts` (usually a `⌘` chord). Add row to `ShortcutsModal`.
- **New keyboard shortcut:** see § 7 — pick the right layer, add to the correct `SECTIONS` entry.
- **New integration:** add env var to `env.ts` (optional unless critical). Add a client module under `apps/api/src/services/`. Keep retry/rate-limit logic inside the client, not the route.

### 14.2 Pre-wired extension points

- `brands.custom_fields` (jsonb) — for brand-level metrics, deal stage, renewal dates. Already ships with default `'{}'`.
- `sync_config.matchRules.titleKeywords` — not surfaced in current UI but the backend honors it. A future "edit rules" panel can set it.
- `meeting_source` enum + `brand_meetings.external_meeting_id` — structured for future sources beyond tldv (Zoom, Granola, etc.). Comma-separated format for merged meetings is the current convention.
- `export_file` schema versioning (currently `1.3`). Add next-version fields as `.optional().default([])` to stay backward-compat; bump the literal in both Zod and the export route.
- `feature_requests_config.columnMapping` — already supports non-canonical column orders if `standardize=false`.

### 14.3 Known asymmetries and gotchas

- **Task/action-item sync is one-way.** Completing a task → marks linked action item done. Completing an action item → does NOT complete the linked task. Intentional — an action item in a brand may not be "the" task the user was tracking. Revisit if users report confusion.
- **Action-item extraction runs only on meeting creation**, not on `PATCH`. Editing `rawNotes` after creation won't produce new action items.
- **Feature request `date` is a `text` column, not `date`.** Intentional — sheets contain flexible formats ("3/27", "3/27/2026", "2026-03-27"). Normalization happens in `google-sheets.ts normalizeDate`, but the DB preserves the normalized string. Any future UI that filters by date has to re-parse.
- **Role deletion** sets tasks/parkings' `role_id=null` (cascade SET NULL). The UI displays "No role" for these — no data loss.
- **Brand deletion** cascades to stakeholders/meetings/action-items/feature-requests but **leaves tasks that were sent-to-today alive** (with `brand_action_items.linked_task_id=null` after the cascade SET NULL on the action item side; but since the action item is deleted, not null'd, the task simply loses its brand back-link). Same for feature requests converted to action items.
- **Multi-transcript dedup**: within a single `/sync/confirm` batch, `existingActionItems` is updated in-memory after each meeting, so a second meeting's items get deduped against the first's newly-created ones. But the newly-created items have `id=''` in the in-memory list (real IDs not read back) — the LLM can see their text but can't target them for update. Acceptable for batches <100 items.
- **tldv `happenedAt`** is returned in two formats. Already normalized to ISO by `normalizeMeeting`. Downstream code can assume ISO.
- **`brand_feature_requests.sheet_row_index`** is 0-indexed (matches `google-sheets` API). When writing back, remember A1 notation is 1-indexed (hence `rowIndex + 1` in `clearRow`).

### 14.4 Areas intentionally deferred (from `docs/TODO.md`)

- Voice control (Web Speech API + LLM intent parser).
- Optimistic updates / offline support / PWA.
- Timezone-aware server-side "today" (currently browser-local).
- Recurring tasks, task search, task subtasks.
- Drag-and-drop between lanes.
- Brand-level full-text search.
- `.docx` brand import (currently `.md`/`.txt` only).
- Deployment recipe (Dockerfile, CI/CD, managed postgres).
- Multi-device refresh-token auth.
- E2E tests (Playwright).
- A11y: visible focus rings, `aria-live` toasts, reduce-motion, high-contrast.

---

## 15. Release history (abridged)

| Version | Date | Headline |
|---|---|---|
| 0.6.2 | 2026-04-17 | Keyboard nav for meeting form suggestions |
| 0.6.1 | 2026-04-17 | Parkings priority stripes restored |
| 0.6.0 | 2026-04-16 | Feature Requests — Google Sheets two-way sync |
| 0.5.0 | 2026-04-16 | Brand detail view redesigned with tabbed layout |
| 0.4.1 | 2026-04-16 | Action-item deduplication on recording sync |
| 0.4.0 | 2026-04-15 | Meeting recording sync (tldv) |
| 0.3.0 | 2026-04-15 | Brands — client management meets daily execution |
| 0.2.5 | 2026-04-15 | Global shortcuts work from every view |
| 0.2.4 | 2026-04-15 | View navigation no longer broken by auto-focused inputs |
| 0.2.3 | 2026-04-15 | Tab restored to browser; `g`-prefix + bracket cycling introduced |
| 0.2.2 | 2026-04-15 | Shortcuts help made accurate |
| 0.2.1 | 2026-04-15 | Slim icon sidebar, Today/Backlog as tabs under Tasks |
| 0.2.0 | 2026-04-15 | Sidebar, Parkings, "What's new" modal |

Full changelog: `apps/web/src/lib/releaseNotes.ts`.

---

## 16. Design axioms (for framing future feature proposals)

When proposing a new feature, evaluate against these:

1. **Does it preserve keyboard-first?** Every action must be reachable without the mouse. A feature that requires mousing is an accessibility regression.
2. **Does it respect Today-only default?** Default views should not overwhelm. New surfaces that show "everything" are expected to be opt-in secondary views.
3. **Does it fit the role/context model?** If data should be role-scoped, it needs a `role_id` column from day 1.
4. **Does it have a daily-ritual hook?** Features that don't connect to the morning-plan / evening-review / daily-standup rituals tend to feel bolt-on. If you can't describe where it fits in the day, reconsider.
5. **Is it opinionated?** Momentum is not a configurable platform. Pick one way, make it great, skip the preferences panel.
6. **Does it preserve the single-user assumption?** Multi-user features require rethinking JWT scoping, ACLs, and auth. Out of scope for V2 unless explicitly planned.
7. **Does it need a new integration?** Integrations have real cost: credentials, rate limits, failure modes. Prefer composing with existing ones (OpenAI, tldv, Google Sheets).
8. **Does the data contract change?** If yes: Zod schema in `packages/shared` first, DB migration next, mapper + route last. Never the other way around.
9. **Does it earn a keyboard shortcut?** Not every action does. Shortcuts are scarce real estate. A shortcut implies the user will do the action frequently.
10. **Is there a rollback path?** Can the user undo this action? If it's destructive and multi-step, it needs a confirm modal (the in-app one, not `window.confirm`).
