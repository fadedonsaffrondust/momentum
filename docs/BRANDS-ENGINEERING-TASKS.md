# Brands Feature — Engineering Tasks

Track progress across sessions. Mark each task complete after the session that ships it.

Reference: [`MOMENTUM-BRANDS-FEATURE-SPEC.md`](./MOMENTUM-BRANDS-FEATURE-SPEC.md) for the full product spec. [`plans/radiant-puzzling-finch.md`](../.claude/plans/radiant-puzzling-finch.md) for the implementation plan.

---

## Task 1: Data model + schemas + DB + API routes

**Status:** `[x] Complete`

**Scope:**

- `packages/shared/src/schemas.ts` — add Zod schemas: `brandSchema`, `brandStakeholderSchema`, `brandMeetingSchema`, `brandActionItemSchema`, `brandActionStatusSchema`, plus create/update input schemas for each
- `packages/db/src/schema.ts` — add tables: `brands`, `brand_stakeholders`, `brand_meetings`, `brand_action_items`, plus `brandActionStatusEnum`
- Generate and apply Drizzle migration (`pnpm db:generate && pnpm db:migrate`)
- `apps/api/src/mappers.ts` — add `mapBrand`, `mapBrandStakeholder`, `mapBrandMeeting`, `mapBrandActionItem`
- `apps/api/src/routes/brands.ts` — CRUD for brands
- `apps/api/src/routes/brand-stakeholders.ts` — nested under `/brands/:brandId/stakeholders`
- `apps/api/src/routes/brand-meetings.ts` — nested under `/brands/:brandId/meetings`
- `apps/api/src/routes/brand-action-items.ts` — nested under `/brands/:brandId/action-items`, includes `/send-to-today` and `/complete`
- `apps/api/src/routes/brand-import.ts` — `POST /brands/import` (bulk-create brand + meetings + action items + stakeholders)
- `apps/api/src/index.ts` — register all new routes
- `packages/shared/src/schemas.ts` — extend `exportFileSchema` to v1.2 with brands/meetings/stakeholders/actionItems
- `apps/api/src/routes/data.ts` — include brands data in export/import

**Verification:** curl smoke test: create brand → add stakeholder → add meeting → add action item → `/send-to-today` creates a linked task → complete task → action item status flips.

---

## Task 2: Frontend — Sidebar + routing + Brand list + empty state

**Status:** `[x] Complete`

**Scope:**

- `apps/web/src/layout/Sidebar.tsx` — add Brands icon (building/briefcase icon)
- `apps/web/src/App.tsx` — add `/brands` and `/brands/:id` routes
- `apps/web/src/pages/BrandsPage.tsx` — two-column layout (left rail + detail outlet)
- `apps/web/src/components/brands/BrandListRail.tsx` — search input, brand list, "+ New Brand", "Import from file"
- `apps/web/src/components/brands/BrandListItem.tsx` — name, health dot, recency
- `apps/web/src/components/brands/HealthPill.tsx` — computed green/amber/red dot
- `apps/web/src/hooks/useBrandHealth.ts` — pure function: meetings + actionItems → health status
- `apps/web/src/api/hooks.ts` — add brand-related query/mutation hooks
- Empty state when no brand selected

**Verification:** navigate to Brands via sidebar, create a brand, see it in the list with health dot, search/filter works.

---

## Task 3: Brand Detail — Header + Pulse section

**Status:** `[x] Complete`

**Scope:**

- `apps/web/src/components/brands/BrandDetailView.tsx` — orchestrates all sections for a selected brand
- `apps/web/src/components/brands/BrandDetailHeader.tsx` — sticky header: editable brand name (double-click), health pill, "+ New Meeting Note" button, "⋯" menu (Edit, Delete, Export)
- `apps/web/src/components/brands/PulseSection.tsx` — three horizontal sub-panels:
  - Activity snapshot: last meeting, cadence, total count
  - Open action items (top 3) with "Send to Today" + "Mark Done" inline actions
  - Stakeholder activity: circular initials, tooltip, click to filter meetings
- `apps/web/src/components/brands/StakeholderBadge.tsx` — circular initial with color + tooltip

**Verification:** open a brand with meetings and action items, see Pulse populated with correct stats, stakeholder badges render, "Send to Today" placeholder fires a toast.

---

## Task 4: Brand Detail — North Star + Action Items sections

**Status:** `[x] Complete`

**Scope:**

- `apps/web/src/components/brands/NorthStarSection.tsx` — collapsible section with:
  - Goals (multiline, inline-editable, auto-save on blur with checkmark)
  - Key Stakeholders list (add/edit/remove, "+" button)
  - Success Definition (multiline, inline-editable)
- `apps/web/src/components/brands/ActionItemsSection.tsx` — collapsible with count in header:
  - Two tabs: Open (default) / Done
  - Each item: checkbox, text, owner, due date, source meeting link, age
  - Inline create: "+ Add action item" with optional owner + due date
  - Hover actions: "Send to Today", "Edit", "Delete"
- `apps/web/src/components/brands/ActionItemRow.tsx` — single row component with all interactions

**Verification:** edit North Star fields, blur, see checkmark confirmation. Add action items, toggle tabs, mark done, verify counts update in section header.

---

## Task 5: Meetings Archive + Meeting Note modal + Raw Context

**Status:** `[x] Complete`

**Scope:**

- `apps/web/src/components/brands/MeetingsSection.tsx` — collapsible, default collapsed, reverse-chron:
  - Each entry: date, title, attendees (initials), 1-line summary
  - Click expands inline: full notes, decisions, "Extract action items" button
  - Edit / Delete options per meeting
- `apps/web/src/components/brands/MeetingNoteModal.tsx` — full-width overlay modal:
  - Fields: date (default today), title (with autocomplete from past titles), attendees (chip input from stakeholders), notes (large textarea with markdown hints), decisions (optional textarea)
  - On save: regex extraction of action items from `→`, `- [ ]`, "Action item:", "Next steps:" patterns
  - `Cmd+Enter` saves, `Escape` cancels with confirmation if dirty
- `apps/web/src/components/brands/RawContextSection.tsx` — shows raw import + "Coming soon" custom fields

**Verification:** create a meeting with `→ Follow up with Danna` in notes → on save, action item auto-extracted. Expand a meeting in the archive, edit it, delete it.

---

## Task 6: Import Feature (server-side OpenAI, async)

**Status:** `[x] Complete`

**Scope:**

- **Server:**
  - Add `OPENAI_API_KEY` to `.env.example` and `apps/api/src/env.ts` schema
  - `pnpm --filter @momentum/api add openai`
  - `apps/api/src/routes/brand-import.ts` — update `POST /brands/import`:
    - Accepts `{ fileName, fileContent }` (text body, not multipart for V1)
    - Creates a stub brand with `status: 'importing'`, returns it immediately
    - Spawns an async task: calls OpenAI chat completions with the structured extraction prompt from the spec, parses response, creates stakeholders + meetings + action items, flips brand `status` to `active`
    - On error: sets `status: 'import_failed'` and `import_error` with the error message
  - Add `brand_status` enum (`active`, `importing`, `import_failed`) to DB schema + migration
  - Add `import_error` text column to brands table
- **Frontend:**
  - `apps/web/src/components/brands/ImportBrandModal.tsx` — simplified:
    - Step 1: file picker (.md only), "Analyze" button
    - On click: send to API, get back stub brand, close modal, show non-blocking toast "Importing [filename]..."
    - Brand appears in list with a subtle loading spinner
  - Poll `GET /brands/:id` every 3s while `status === 'importing'`
  - When `status === 'active'`: stop polling, invalidate queries, update toast → "Imported 'Brand Name' — X meetings, Y action items"
  - When `status === 'import_failed'`: stop polling, show error toast with `import_error`
  - User can navigate freely while import runs
- Edge cases: empty fields, truncation at 50k chars, malformed file, API errors, OpenAI rate limits

**Verification:** import a `.md` file → modal closes immediately → brand appears in list with spinner → user navigates to Today (keeps working) → after ~10-30s brand flips to active → toast fires → navigate to brand → all data present. Test with invalid file → clear error. Test with server env missing `OPENAI_API_KEY` → clear 500 error.

---

## Task 7: Send to Today (bidirectional sync) + shortcuts + polish

**Status:** `[x] Complete`

**Scope:**

- **Bidirectional sync:**
  - "Send to Today" on action item → `POST /brands/:brandId/action-items/:id/send-to-today` creates task with `linkedActionItemId` reference, brand badge on task card
  - Complete task in Today → API marks linked action item as done
  - Complete action item in Brands → API marks linked task as done
  - Add `linkedActionItemId` to task schema (nullable FK)
  - `TaskCard.tsx` — show small brand badge when `linkedActionItemId` is set
- **Keyboard shortcuts:**
  - `Cmd+B` in `useGlobalShortcuts` → navigate to `/brands`
  - Reassign `g b` from Backlog → Brands; Backlog moves to `g l`
  - Extend `VIEW_CYCLE` to include `/brands`
  - Brand page shortcuts in `useKeyboardController`: `j/k` in list, `Enter` open, `Escape` back, `n` new meeting, `a` new action item
- **Polish:**
  - Update `ShortcutsModal` with Brands section
  - Release notes v0.3.0 entry
  - Update `docs/TODO.md` with out-of-scope items from the spec
  - Update `README.md` if stack/setup changed
  - Verify export/import round-trips brands data (v1.2)
  - Final `pnpm -r typecheck && pnpm -r build`

**Verification:** full end-to-end: import brand → send action item to Today → complete in Today → action item auto-done → health pill updates. All shortcuts work. Export contains brands. Typecheck + build clean.
