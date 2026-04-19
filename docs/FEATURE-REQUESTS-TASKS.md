# Feature Requests — Engineering Tasks

Each task is one session. Complete in order (dependencies listed). Mark `[x]` when done.

---

## Task 1: Database Schema + Shared Types

**Dependencies:** None

- [x] Add `featureRequestSyncStatusEnum` pgEnum (`synced`, `pending`, `error`) to `packages/db/src/schema.ts`
- [x] Add `brandFeatureRequests` table: id (UUID), brandId (FK brands cascade), userId (FK users cascade), sheetRowIndex (integer nullable), date (text), request (text), response (text nullable), resolved (boolean default false), syncStatus (enum default 'pending'), createdAt, updatedAt
- [x] Add indexes on `brandId` and `(brandId, syncStatus)`
- [x] Add `featureRequestsConfig` JSONB column (nullable) to `brands` table — schema: `{ sheetId, sheetGid, sheetUrl, connected, lastSyncedAt, columnMapping }`
- [x] Add Zod schemas in `packages/shared/src/schemas.ts`: `featureRequestSyncStatusSchema`, `featureRequestsConfigSchema`, `brandFeatureRequestSchema`, `createBrandFeatureRequestInputSchema`, `updateBrandFeatureRequestInputSchema`
- [x] Update `brandSchema` to include optional `featureRequestsConfig`
- [x] Export new types from shared package
- [x] Generate and apply Drizzle migration (`pnpm db:generate && pnpm db:migrate`)
- [x] Verify: `pnpm typecheck` passes

---

## Task 2: API CRUD Routes + Mapper

**Dependencies:** Task 1

- [x] Add `mapBrandFeatureRequest()` to `apps/api/src/mappers.ts`
- [x] Update `mapBrand()` to include `featureRequestsConfig` field
- [x] Create `apps/api/src/routes/brand-feature-requests.ts` with:
  - `GET /brands/:brandId/feature-requests` — optional `?resolved=true|false`, `?search=...` query params, ordered by date DESC
  - `POST /brands/:brandId/feature-requests` — create with `{ date, request, response?, resolved? }`
  - `PATCH /brands/:brandId/feature-requests/:id` — partial update, sets syncStatus to 'pending'
  - `DELETE /brands/:brandId/feature-requests/:id` — delete with ownership check
- [x] Register routes in `apps/api/src/index.ts`
- [x] Create `apps/api/src/routes/brand-feature-requests.test.ts` — tests for all four endpoints using mock-db
- [x] Verify: `pnpm test` and `pnpm typecheck` pass

---

## Task 3: Google Sheets Service Client

**Dependencies:** None (can parallel with Task 2)

- [x] Add `googleapis` dependency to `apps/api/package.json`
- [x] Add optional `GOOGLE_SERVICE_ACCOUNT_KEY` to env config (`apps/api/src/env.ts` or equivalent)
- [x] Create `apps/api/src/services/google-sheets.ts`:
  - `parseSheetUrl(url)` — extract spreadsheetId and gid from Google Sheets URL
  - `analyzeColumns(headerRow)` — heuristic mapping of header names to canonical fields (Date, Request, Response, Resolved) using case-insensitive keyword matching
  - `readSheet(spreadsheetId, gid?)` — read all rows via Sheets API v4
  - `writeRow(spreadsheetId, gid, rowIndex, values)` — update a single row
  - `appendRow(spreadsheetId, gid, values)` — append a row at the end
  - `deleteRow(spreadsheetId, gid, rowIndex)` — delete/clear a row
  - `rewriteHeaders(spreadsheetId, gid, newHeaders)` — standardize header row
  - JWT auth via service account credentials
- [x] Create `apps/api/src/services/google-sheets.test.ts` — unit tests for `parseSheetUrl`, `analyzeColumns` (mock googleapis calls)
- [x] Verify: `pnpm test` passes

---

## Task 4: Sync API Routes (Connect, Pull, Push, Disconnect)

**Dependencies:** Tasks 1, 2, 3

- [x] Add sync-related Zod schemas to `packages/shared/src/schemas.ts`: `connectSheetInputSchema`, `connectSheetResponseSchema`, `sheetSyncPullResponseSchema`, `sheetSyncPushResponseSchema`
- [x] Create `apps/api/src/routes/brand-feature-request-sync.ts`:
  - `POST /brands/:brandId/feature-requests/connect-sheet` — parse URL, read sheet, analyze columns, save config on brand, import all rows
  - `POST /brands/:brandId/feature-requests/sync/pull` — read sheet, diff against DB by sheetRowIndex, create/update/remove, return stats
  - `POST /brands/:brandId/feature-requests/sync/push` — write all pending DB rows to sheet, update sheetRowIndex for new rows, set syncStatus to 'synced'
  - `POST /brands/:brandId/feature-requests/disconnect-sheet` — clear config, null out sheetRowIndex on all rows
- [x] Register routes in `apps/api/src/index.ts`
- [x] Create `apps/api/src/routes/brand-feature-request-sync.test.ts` — tests with mocked GoogleSheetsClient
- [x] Verify: `pnpm test` and `pnpm typecheck` pass

---

## Task 5: Frontend API Hooks

**Dependencies:** Tasks 2, 4

- [x] Add to `apps/web/src/api/hooks.ts`:
  - `useBrandFeatureRequests(brandId, params?)` — query with resolved/search filters
  - `useCreateBrandFeatureRequest(brandId)` — mutation, invalidates feature-requests
  - `useUpdateBrandFeatureRequest(brandId)` — mutation, invalidates feature-requests
  - `useDeleteBrandFeatureRequest(brandId)` — mutation, invalidates feature-requests
  - `useConnectFeatureRequestSheet(brandId)` — mutation, invalidates brand + feature-requests
  - `useDisconnectFeatureRequestSheet(brandId)` — mutation, invalidates brand + feature-requests
  - `usePullFeatureRequests(brandId)` — mutation, invalidates feature-requests
  - `usePushFeatureRequests(brandId)` — mutation, invalidates feature-requests
- [x] Verify: `pnpm typecheck` passes

---

## Task 6: Feature Requests Tab UI — Table + Tab Bar

**Dependencies:** Task 5

- [x] Extend `BrandTab` type in `BrandTabBar.tsx` to include `'feature-requests'`
- [x] Add third tab "Feature Requests" with open count badge (same style as Work tab)
- [x] Update `BrandDetailView.tsx`: fetch feature requests, render `FeatureRequestsTab` when active, add `3` and `f` keyboard shortcuts
- [x] Create `apps/web/src/components/brands/FeatureRequestsTab.tsx`:
  - Header bar: title + count badge + "Sync" button + "Open in Sheets" link + last synced timestamp
  - Filter bar: All/Open (default)/Resolved toggle + search input + sort toggle
  - Table: Date, Request, Response, Resolved columns (read-only for now)
  - Resolved rows: muted text, strikethrough on Request
  - Empty state: "No feature requests" with "Connect Sheet" CTA if no sheet, or "Add one manually" if sheet connected
  - Pagination: 50 rows with "Load more" button
- [x] Verify: tab appears, switches work, table renders with mock/empty data, filters work

---

## Task 7: Inline Editing + Create/Delete

**Dependencies:** Task 6

- [x] Create `apps/web/src/components/brands/FeatureRequestRow.tsx`:
  - Double-click cell to enter edit mode (input/textarea replaces text)
  - Enter or blur saves, Escape cancels
  - Resolved checkbox: single-click toggle, immediate update
  - Hover actions column: edit (pencil), delete (trash)
  - Saving indicator: subtle spinner while mutation is pending
  - Error indicator: warning icon if syncStatus is 'error'
- [x] Wire into `FeatureRequestsTab.tsx`:
  - "+ New Request" button: inserts editable row at top, date pre-filled with today, focus on Request field
  - Tab from request field to response field, Enter saves new row, Escape removes if empty
  - Delete: confirm modal, then delete mutation
  - "Add Manually" button in empty state alongside "Connect Google Sheet"
- [x] Verify: typecheck and tests pass

---

## Task 8: Sheet Connection Modal + Sync UI

**Dependencies:** Tasks 6, 7

- [x] Create `apps/web/src/components/brands/ConnectSheetModal.tsx`:
  - URL input field with inline validation (must be Google Sheets URL)
  - "How it works" info box explaining the flow
  - "Standardize headers" checkbox option
  - Phase state machine: input → connecting → done/error
  - Shows detected columns and import count on success
  - Error states with "Try Again" option
  - Portal-based rendering (matches SyncReviewModal pattern)
- [x] Wire sync UI in `BrandDetailView.tsx`:
  - showConnectSheet state + ConnectSheetModal rendering
  - Sync button triggers pull → push sequentially with toast notifications
  - "Last synced: X ago" timestamp in FeatureRequestsTab header
  - "Open in Sheets" external link
  - Stale indicator dot on tab if lastSyncedAt > 5 minutes ago (amber dot in BrandTabBar)
- [x] Verify: typecheck and tests pass

---

## Task 9: Convert Feature Request to Action Item

**Dependencies:** Tasks 2, 7

- [x] Add `POST /brands/:brandId/feature-requests/:id/convert-to-action` endpoint in `brand-feature-requests.ts`:
  - Creates brandActionItem with text from feature request
  - Marks feature request as resolved, sets syncStatus to 'pending'
  - Returns both items
- [x] Add `convertFeatureRequestResponseSchema` in shared schemas
- [x] Add `useConvertFeatureRequestToAction(brandId)` hook (invalidates both feature-requests and action-items)
- [x] Wire "Convert to Action Item" arrow button in `FeatureRequestRow.tsx` hover actions (only shown on unresolved)
- [x] Show toast on success: "Created action item. Feature request marked resolved."
- [x] Add 2 tests for the convert endpoint (success + 404)
- [x] Verify: typecheck and all 160 tests pass

---

## Task 10: Pulse Stats + Keyboard Shortcuts

**Dependencies:** Tasks 6, 7, 8

- [x] Add feature request summary card in `OverviewTab.tsx` health section (3-column grid):
  - "X open, Y resolved" counts with "Sheet connected" indicator
  - "View all →" link switches to Feature Requests tab
- [x] Implement keyboard shortcuts in `FeatureRequestsTab.tsx`:
  - `n` — new request (starts adding mode)
  - `j`/`k` or `Down`/`Up` — navigate rows (focusedIndex state)
  - `Space` — toggle resolved on focused row
  - `r` — trigger manual sync
  - `Escape` — deselect row
  - Shortcuts disabled when in adding mode or when input/textarea focused
- [x] Visual focus indicator: accent ring + subtle bg on focused row (`isFocused` prop on FeatureRequestRow)
- [x] Verify: typecheck and all tests pass

---

## Task 11: Export/Import + Tests + Release Notes + Docs

**Dependencies:** All previous tasks

- [x] Update `exportFileSchema` version enum to include `'1.3'` in shared schemas
- [x] Add `brandFeatureRequests` array to export schema (optional, defaults to [])
- [x] Update export route in `apps/api/src/routes/data.ts` — version bumped to 1.3, queries + maps feature requests
- [x] Update import route — deletes feature requests on replace, imports with brand ID remapping, added to response schema
- [x] Add Feature Requests section to `apps/web/src/modals/ShortcutsModal.tsx` (n, j/k, Space, r, Esc) + updated Brands section (3, f)
- [x] Add release notes entry v0.6.0 in `apps/web/src/lib/releaseNotes.ts` (6 items)
- [x] Update `docs/TODO.md`: added "Feature Requests — deferred (V2)" section with 7 items
- [x] Update `README.md`: added googleapis to tech stack, GOOGLE_SERVICE_ACCOUNT_KEY env var docs
- [x] Added 2 new shared schema tests for v1.3 export + backward compat
- [x] Verify: `pnpm typecheck && pnpm test` all pass — 4/4 packages, 361 total tests
