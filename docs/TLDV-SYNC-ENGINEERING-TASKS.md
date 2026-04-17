# tldv Meeting Sync — Engineering Tasks

Track progress by marking tasks complete (`[x]`) at the end of each session.

---

## Task 1: Data Model & Schema Updates
- [x] **Complete**

### Goal
Extend the DB schema, Zod schemas, and mappers to support meeting recording sync.

### Changes
1. **`packages/db/src/schema.ts`**
   - Add `email` (text, nullable) to `brandStakeholders`
   - Add new enum `meetingSourceEnum`: `'manual'` | `'recording_sync'`
   - Add to `brandMeetings`: `source` (meetingSourceEnum, default `'manual'`), `externalMeetingId` (text, nullable, unique per brand), `recordingUrl` (text, nullable)
   - Add `syncConfig` (jsonb, nullable) to `brands` — stores `{ matchRules, syncedMeetingIds[], lastSyncedAt, lastSyncedMeetingDate }`
   - Generate migration: `pnpm db:generate`

2. **`packages/shared/src/schemas.ts`**
   - Add `meetingSourceSchema` enum
   - Add `source`, `externalMeetingId`, `recordingUrl` to `brandMeetingSchema`
   - Add `email` to `brandStakeholderSchema` and create/update input schemas
   - Add `syncConfigSchema` (Zod object for the jsonb shape)
   - Add `syncConfig` to `brandSchema`

3. **`apps/api/src/mappers.ts`** — update `mapBrandMeeting`, `mapBrandStakeholder`, `mapBrand` for new fields

4. **`apps/api/src/routes/brand-stakeholders.ts`** — accept `email` in create/update

5. **`apps/api/src/env.ts`** — add `TLDV_API_KEY: z.string().optional()`

6. **`.env.example`** — add `TLDV_API_KEY=`

7. **Tests** — schema validation tests for new fields, mapper tests

### Verification
- `pnpm db:generate` produces a clean migration
- `pnpm db:migrate` applies without errors
- `pnpm typecheck` passes
- `pnpm test` passes

---

## Task 2: tldv API Client
- [x] **Complete**

### Goal
Create a typed HTTP client for the tldv API with retry logic.

### Changes
1. **`apps/api/src/services/tldv.ts`** (new)
   - `TldvClient` class, constructed with `apiKey: string`
   - Base URL: `https://pasta.tldv.io/v1alpha1`
   - Auth: `x-api-key` header
   - Methods:
     - `listMeetings(params: { query?, page?, limit?, from?, to?, meetingType? })` → paginated results
     - `getMeeting(id: string)` → single meeting
     - `getTranscript(id: string)` → transcript with sentences
     - `getHighlights(id: string)` → highlights array
   - Private `fetchWithRetry(url, options)` — exponential backoff, max 3 retries, retry on 5xx/429, no retry on 4xx
   - TypeScript interfaces for all tldv response shapes (Meeting, Transcript, Highlight, etc.)

2. **`apps/api/src/services/tldv.test.ts`** (new)
   - Mock `fetch` globally
   - Test successful calls, retry on 5xx, retry on 429, fail on 401 (no retry), pagination

### Verification
- `pnpm test` passes
- `pnpm typecheck` passes

---

## Task 3: Matching Engine & Sync Backend Routes
- [x] **Complete**

### Goal
Build the scoring engine, sync endpoints, and OpenAI extraction pipeline.

### Changes
1. **`apps/api/src/services/meeting-scorer.ts`** (new)
   - Pure function: `scoreMeeting(meeting, matchRules, stakeholders, syncedIds)` → `{ score, reasons[] }`
   - Scoring: stakeholder email match +50, title keyword +30, meeting type match +10, already synced -1000
   - `categorizeCandidates(scored[])` → `{ likely (>=50), possible (10-49) }`

2. **`apps/api/src/services/meeting-extraction.ts`** (new)
   - `extractMeetingContent(transcript, highlights, brand, stakeholders)` → structured JSON
   - Uses OpenAI `gpt-4o-mini` with the system prompt from the spec
   - Token management: truncate transcripts >80k chars (keep first 30min + last 15min)
   - Returns `{ summary, actionItems[], decisions[], attendees[] }`

3. **`apps/api/src/routes/brand-sync.ts`** (new)
   - `POST /brands/:brandId/sync/candidates`
     - Reads brand's syncConfig + stakeholders from DB
     - Calls tldv `listMeetings` with filters from matchRules
     - Scores each candidate
     - Returns `{ candidates: ScoredCandidate[], lastSyncInfo }`
   - `POST /brands/:brandId/sync/confirm`
     - Body: `{ meetingIds: string[] }`
     - For each selected meeting (sequentially):
       1. Fetch transcript + highlights from tldv
       2. Run OpenAI extraction
       3. Merge-or-create meeting note (check for same brand+date)
       4. Create action items
       5. Add to syncedMeetingIds
     - Returns `{ imported, errors[], pendingTranscripts }`

4. **`apps/api/src/index.ts`** — register `brandSyncRoutes`

5. **`packages/shared/src/schemas.ts`** — add request/response schemas for sync endpoints

6. **Tests** — scoring engine (unit), extraction (mocked OpenAI), route handlers (mocked DB + tldv)

### Verification
- Scoring engine produces correct scores for various meeting/rule combos
- `pnpm typecheck` and `pnpm test` pass

---

## Task 4: Sync Settings UI (Per-Brand Config)
- [x] **Complete**

### Goal
Build the UI for configuring matching rules per brand and displaying stakeholder emails.

### Changes
1. **`apps/web/src/components/brands/SyncSettingsPanel.tsx`** (new)
   - Collapsible/slideover panel toggled by gear icon in brand header
   - Sections:
     - **Stakeholder emails**: auto-populated from brand stakeholders, shows which have emails vs not, link to edit stakeholder to add email
     - **Title keywords**: comma-separated text input
     - **Meeting type filter**: dropdown — External only (default), Internal only, Both
     - **Sync window**: dropdown — 7, 14, 30, 90 days
   - Save button → PATCH brand with updated syncConfig
   - Warning if no stakeholder emails configured

2. **`apps/web/src/components/brands/BrandDetailHeader.tsx`** — add gear icon next to existing buttons

3. **`apps/web/src/components/brands/BrandDetailView.tsx`** — state for showing sync settings

4. **`apps/web/src/api/hooks.ts`** — `useUpdateBrandSyncConfig` hook

5. **Stakeholder email editing** — update `StakeholderBadge.tsx` or create edit form to include email field

6. **Tests** — component render tests, hook tests

### Verification
- Can open sync settings panel from brand detail
- Can configure matching rules and save
- Can add/edit emails on stakeholders
- `pnpm typecheck` and `pnpm test` pass

---

## Task 5: Sync Review Modal
- [x] **Complete**

### Goal
Build the candidate review and confirmation modal — the core UX for the sync flow.

### Changes
1. **`apps/web/src/components/brands/SyncReviewModal.tsx`** (new)
   - Header: "Sync Recordings for [Brand Name]"
   - Subheader: "Found X meetings since [date]"
   - Two sections: "Likely matches" (green, pre-checked) and "Possible matches" (amber, unchecked)
   - Each row: checkbox, meeting name, date, attendee pills, match reason, confidence pill
   - Footer: "Sync Selected (N)" button, "Skip All" button
   - Progress view during import: "Processing 2 of 5..." with progress bar
   - Empty state: "No new meetings found matching your rules"
   - Error states: no API key configured, rate limit hit, partial failures

2. **`apps/web/src/components/brands/SyncCandidateRow.tsx`** (new)
   - Single candidate row component

3. **`apps/web/src/components/brands/BrandDetailHeader.tsx`** — add "Sync Recordings" button (refresh icon, loading state)

4. **`apps/web/src/components/brands/BrandDetailView.tsx`** — wire up sync modal state + trigger

5. **`apps/web/src/api/hooks.ts`** — `useFetchSyncCandidates(brandId)`, `useConfirmSync(brandId)`

6. **Keyboard navigation in modal**: j/k to move between rows, Enter to toggle checkbox, Cmd+Enter to confirm, Escape to close

7. **Tests** — modal rendering, candidate selection, keyboard navigation

### Verification
- Can trigger sync from brand detail
- Modal shows scored candidates with correct categorization
- Can select/deselect and confirm
- Progress indicator works during sync
- `pnpm typecheck` and `pnpm test` pass

---

## Task 6: Recording Links, Shortcuts, Polish & Release Notes
- [x] **Complete**

### Goal
Add recording links to meeting notes, register keyboard shortcuts, and ship the release notes entry.

### Changes
1. **`apps/web/src/components/brands/MeetingsSection.tsx`**
   - On meeting notes with `recordingUrl`: show "Recording" link (small play icon) that opens in new tab
   - Only visible when `recordingUrl` is truthy

2. **`apps/web/src/hooks/useGlobalShortcuts.ts`** (or page-scoped handler)
   - `s` on brand detail view → open Sync Review Modal

3. **`apps/web/src/modals/ShortcutsModal.tsx`**
   - Add to Brands section: `s` — Sync recordings
   - Add Sync Review Modal section: `j/k` — Navigate candidates, `Enter` — Toggle selection, `Cmd+Enter` — Confirm sync, `Esc` — Close

4. **`apps/web/src/lib/releaseNotes.ts`**
   - New entry: meeting recording sync feature (bump minor version)

5. **`docs/TODO.md`** — remove shipped items, add any remaining follow-ups

6. **Toast messages**:
   - "Synced N meeting recordings" on success
   - "N meetings still processing — re-sync later" for pending transcripts
   - Error toasts for failures

7. **Tests** — recording link rendering, shortcut registration

### Verification
- Recording links appear on synced meeting notes and open correctly
- `s` shortcut triggers sync from brand detail
- Modal keyboard shortcuts work
- ShortcutsModal matches actual bindings
- Release notes entry renders in "What's New" modal
- `pnpm typecheck` and `pnpm test` pass
- Full end-to-end manual test of the sync flow
