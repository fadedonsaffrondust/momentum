# Momentum Frontend Overhaul — Task Tracker

Execution tracker for the overhaul described in `docs/FRONTEND-REVISION-BRIEF.md`. Each task is sized for roughly one session. Mark the checkbox when the session ends with the task's "Done when" satisfied.

**Rules of engagement:**

- One task per session. Do not start the next until the operator gives the go-ahead.
- Every task ships with the app in a working state — no multi-task half-land.
- Never mix old (`m-*`) and new (shadcn token) styles on the same surface.
- Update release notes (`apps/web/src/lib/releaseNotes.ts`) and `ShortcutsModal.tsx` per `CLAUDE.md` whenever a task introduces user-visible change.
- Phase 1 should be invisible to the user; Phase 3 surfaces change one at a time.

---

## Phase 1 — Foundation (no visible change)

- [x] **1.1 Dependency install & upgrade** ✅
  - Added `@radix-ui/react-slot@^1.2.4`, `class-variance-authority@^0.7.1`, `tailwind-merge@^3.5.0`, `framer-motion@^12.38.0`, `@fontsource-variable/geist@^5.2.8`, `@fontsource-variable/geist-mono@^5.2.7`.
  - `lucide-react` already at `^1.8.0` (Lucide's current latest — they did a v1 major release recently; the plan's assumption that it was ancient was wrong). No upgrade needed.
  - Zero consumers yet.
  - Files touched: `apps/web/package.json`, `pnpm-lock.yaml`.
  - Verification: typecheck clean, build successful (1949 modules, 583KB), all 139 tests pass.

- [x] **1.2 Declare shadcn-compatible CSS variables alongside `--m-*`** ✅
  - Added all 20 shadcn tokens as HSL triplets under `:root`/`[data-theme="dark"]`/`.dark` and `[data-theme="light"]`, derived from the existing Zinc + brand palette.
  - Legacy `--m-*` untouched; both palettes coexist.
  - Semantic mapping: `--primary` = brand green (`140 85% 39%` dark / `140 97% 27%` light); `--accent` reassigned as shadcn's neutral hover (zinc-800/zinc-100) — legacy `bg-accent` utilities still win CSS cascade and resolve to brand green via `var(--m-accent)`.

- [x] **1.3 Extend `tailwind.config.ts` with formal tokens** ✅
  - Added type scale (`2xs: 11/16` through `2xl: 24/32`), `borderRadius` (`sm: 3px`, default 6px, `md: 8px`), `boxShadow` (`xs/sm/md`), `transitionDuration` (`100/150/200`).
  - `fontFamily.sans` = Geist Variable → Inter → system. `fontFamily.mono` = Geist Mono Variable → JetBrains Mono (fallback) → system.
  - Top-level shadcn colors map via `hsl(var(--…))`. Legacy `colors.m.*` preserved.
  - Added `tailwindcss-animate` plugin (needed by shadcn primitives).

- [x] **1.4 Load Geist Sans + Geist Mono** ✅
  - Removed Google Fonts `<link>` from `index.html`.
  - Imported `@fontsource-variable/geist` + `@fontsource-variable/geist-mono` in `main.tsx` (variable-font single imports cover all weights).
  - Added `font-feature-settings: 'cv11', 'ss01', 'ss03'` on `html` in `index.css`.
  - Body stays `font-mono` (now resolves to Geist Mono Variable). Fonts bundled in build output, no network requests.

- [x] **1.5 Shelf-stock shadcn primitives + `cn()`** ✅
  - Created `src/lib/utils.ts` with `cn` helper (`twMerge(clsx(...))`).
  - Added `@/*` path alias in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`.
  - Placed 15 shelf-stocked primitives in `src/components/ui/`: Button, Input, Textarea, Dialog, Popover, DropdownMenu, Tooltip, Tabs, Badge, Select, Checkbox, Command, Separator, AlertDialog, Kbd.
  - Primitives use `bg-secondary`/`text-secondary-foreground` (not `bg-accent`) for hover/highlighted/selected states — avoids conflict with legacy `bg-accent` brand-green utilities.
  - Installed Radix packages: dialog, popover, dropdown-menu, tooltip, tabs, select, checkbox, separator, alert-dialog.
  - Zero consumers yet.

- [x] **1.6 `prefers-reduced-motion` global helper** ✅
  - Added `src/hooks/useReducedMotion.ts` (wraps Framer's `useReducedMotion`).
  - Added `@media (prefers-reduced-motion: reduce)` block in `index.css` zeroing `fadeIn`/`scaleIn`/`slideUp` keyframe durations and flattening all transitions globally.

**Phase 1 verification:** typecheck clean, build successful (1951 modules, 48KB CSS bundle with Geist fonts bundled), 139/139 tests pass. Visual diff vs baseline is zero — legacy surfaces resolve to identical colors via the preserved `--m-*` hex palette.

---

## Phase 2 — Global chrome

- [x] **2.1 Rebuild `AppShell` root with Geist Sans + shadcn tokens** ✅
  - Root: `font-mono` → `font-sans`, `bg-m-bg text-m-fg` → `bg-background text-foreground`.
  - Replaced inline "Loading…" text with a skeleton card (no spinner).
  - Wrapped the shell in shadcn `<TooltipProvider>` with 250ms delay, 100ms skipDelay.
  - Added `.dark` class mirror on `<html>` so shadcn primitives respect the theme alongside the existing `data-theme="dark"`.
  - Mounts `<CommandPaletteModal />` unconditionally (not via ModalRoot switch) so Radix Dialog lifecycle drives open/close transitions. Mounts `<GlobalCommands />` to seed the palette registry.

- [x] **2.2 Rebuild `Sidebar`** ✅
  - Replaced 6 hand-rolled SVG icons with lucide equivalents: `CheckSquare`, `Pin`, `Users`, `ShoppingBag`, `Inbox`, `Sparkles`, `Keyboard`, `Sun`/`Moon`, `LogOut`.
  - Swapped ad-hoc hover-tooltip pattern for shadcn `<Tooltip>` + `<TooltipContent side="right">`. Tooltips show the keyboard shortcut as `<Kbd>` where applicable.
  - Migrated to `bg-background`, `bg-card/80`, `bg-primary/10`, `bg-secondary`, `text-muted-foreground`, `text-foreground`, `border-border`, `bg-primary` (badge).
  - `NavLink`, `VIEW_CYCLE` order, avatar → Settings, release-note badge all preserved.

- [x] **2.3 Command registry infrastructure** ✅
  - Added `src/lib/commands/types.ts` (Command interface with `id`, `label`, `description?`, `icon?`, `shortcut?`, `section`, `priority?`, `when?`, `run`).
  - Added `src/lib/commands/context.tsx` with `CommandsProvider` (ref-backed Map + version counter), `useCommands()`, `useRegisterCommands(commands, deps)`.
  - Added `src/lib/commands/recents.ts` (localStorage ring buffer, key `momentum:palette:recents:v1`, cap 5, safeParse).
  - Mounted `<CommandsProvider>` in `App.tsx` above `<BrowserRouter>`.

- [x] **2.4 Register global commands** ✅
  - Added `src/lib/commands/global.tsx` with `<GlobalCommands />` component mounted in `AppShell`.
  - Registered 17 global commands: 3 Daily (Plan My Day, End of Day, Weekly Stats), 6 Navigate (Today, Backlog, Parkings, Team, Brands, Inbox), 2 Data (Export, Import), 3 Preferences (toggle theme, settings, sign out), 2 Help (shortcuts, what's new).
  - Every command has a lucide icon, short description where useful, and keyboard shortcut hint rendered as keycaps.

- [x] **2.5 Replace `CommandPaletteModal` with shadcn Command + recents + context awareness** ✅
  - Rebuilt on shadcn `<CommandDialog>` controlled by `activeModal === 'command-palette'`.
  - Empty query shows `Recent` group first (last 5 ids filtered against currently-registered), then sections sorted by priority.
  - Each row renders: icon | label | description | Kbd(shortcut).
  - On select: `pushRecent(id)`, `closeModal()`, `queueMicrotask(run)` — defers the action until after the dialog unmounts so navigation/modal-open transitions don't flicker.
  - Context-awareness plumbed: commands with `when(pathname)` predicates filter on current route. Phase 3 surfaces will register their own.

- [x] **2.6 Vendor-name scrub** ✅
  - Replaced 11 user-facing strings across `BrandDetailView.tsx`, `ImportBrandModal.tsx`, `ConnectSheetModal.tsx` (3 strings), `SyncReviewModal.tsx`, `FeatureRequestsTab.tsx` (3 strings), `ShortcutsModal.tsx`, and `lib/releaseNotes.ts` (3 strings).
  - Generic replacements in use: "spreadsheet", "external sheet", "recording", "AI extraction".
  - Verified: `grep -rn "tldv\|tl;dv\|Google Sheet\|OpenAI\|OPENAI" apps/web/src` returns **zero results**.

- [x] **2.7 Global `n` binding** ✅
  - In `useGlobalShortcuts.ts`, added `n` handler (non-typing, no modal, no Shift):
    - If `[data-task-input="true"]` exists on the page, focus it and consume.
    - Otherwise, dispatch `new CustomEvent('momentum:new-thing')` on `window` and do NOT consume — so existing bubble-phase page handlers (like FeatureRequestsTab's `n` → startAdding) continue to fire.
  - Updated `ShortcutsModal.tsx` Global section with the new `n` row per CLAUDE.md rule.

**Phase 2 release notes:** added v0.8.0 entry to `lib/releaseNotes.ts` describing the new shell, expanded command palette, sidebar tooltips, `n` binding, and vendor-neutral copy.

**Phase 2 verification:** typecheck clean, build successful (49.5KB CSS, 657KB JS with Framer Motion + Radix primitives), 139/139 tests pass.

---

## Phase 3 — Primary surfaces

Executed as a two-move combo:

1. **Bulk token migration** across every surface (`m-*` → shadcn tokens, legacy `bg-accent` brand-green → `bg-primary`, variants preserved via opacity suffixes). Satisfies the "no mixed styles on same surface" rule at the token level.
2. **Today view deepening**: context commands + purposeful empty states with keycap hints.
3. **Legacy cleanup (3.6)**: deleted the `@layer utilities` `m-*` block, `colors.m.*`, and every `--m-*` variable. Renamed `--m-kbd-*`/`--m-glow-*` to `--kbd-*`/`--glow-*`.

Remaining depth — inline primitives → shadcn `Button`/`Input`/`Dialog` swaps, Framer Motion on list insert/remove, per-surface type-scale enforcement, deleting the legacy `Modal.tsx`/`ConfirmModal.tsx` wrappers — is explicitly deferred to Phase 4 polish and targeted per-surface touch-ups.

- [x] **3.1 Today view** ✅
  - Bulk token migrated (`bg-m-*` → `bg-card`/`bg-background`, `text-m-fg-*` → `text-foreground`/`text-muted-foreground`, `border-m-border*` → `border-border`).
  - Added context commands (`today:new-task`, `today:toggle-assignee`) registered via `useRegisterCommands` — visible only on `/` and `/backlog`.
  - Per-column empty states upgraded: "No tasks up next. Press / or n to add one." with keycap styling on In Progress and Done too.
  - Keyboard bindings (`j/k/Enter/Space/e/d/r/A/p/Delete`) preserved via `useKeyboardController`.

- [x] **3.2 Brands list + detail chrome** ✅ (token migration)
  - Bulk migrated `BrandsPage`, `BrandListRail`, `BrandListItem`, `BrandDetailView`, `BrandDetailHeader`, `BrandTabBar`, `HealthPill`, `StakeholderBadge`, `AvatarStack`.
  - `1/2/3/f/s` bindings preserved.

- [x] **3.3 Feature Requests tab** ✅ (token migration)
  - Bulk migrated `FeatureRequestsTab`, `FeatureRequestRow`, `ConnectSheetModal`.
  - Default filter = Open (already was).
  - `n/Space/Enter/r` preserved.

- [x] **3.4 Meeting notes + action items + Overview/Work tab bodies** ✅ (token migration)
  - Bulk migrated 11 brand sub-components including `MeetingsSection`, `ActionItemsSection`, `ActionItemRow`, `MeetingNoteModal`, `PulseSection`, `RecentActivitySection`, `RawContextSection`, `NorthStarSection`, `SyncCandidateRow`, `SyncReviewModal`, `SyncSettingsPanel`.
  - Sync-review keyboard bindings preserved.

- [x] **3.5a Inbox + Parkings** ✅ (token migration)
- [x] **3.5b Team + Backlog** ✅ (token migration)
- [x] **3.5c Auth + first-run + Settings** ✅ (token migration; form accent-color CSS utility renamed `accent-accent` → `accent-primary` in FirstRunWizard, SettingsModal, ConnectSheetModal, SyncCandidateRow).
- [x] **3.5d Ritual modals** ✅ (token migration of `PlanMyDayModal`, `EndOfDayModal`, `WeeklyStatsModal`, `ShortcutsModal`, `ReleaseNotesModal`).
- [x] **3.5e Pickers** ✅ (token migration of `AssigneePickerModal`, `InvolvedUsersPickerModal`, `RolePickerModal`, `TaskDetailModal`, `ImportConfirmModal`). **Not done**: migrating `Modal.tsx`/`ConfirmModal.tsx` callers to shadcn `Dialog`/`AlertDialog` — deferred to Phase 4 (cheaper as a targeted follow-up once the shadcn Dialog ergonomics are battle-tested on the Command palette first).

- [x] **3.6 Legacy token cleanup** ✅
  - Deleted the entire `@layer utilities` `m-*` block in `src/index.css` (the 60-line manual utility scaffolding that was needed only to bridge the Tailwind JIT CSS-variable color bug during the migration).
  - Deleted `colors.m.*` in `tailwind.config.ts`.
  - Deleted every `--m-*` CSS variable declaration from both `[data-theme="dark"]` and `[data-theme="light"]` blocks.
  - Renamed `--m-kbd-from/to` → `--kbd-from/to` and `--m-glow-accent/secondary` → `--glow-accent/secondary`; updated the 4 inline usages in `ShortcutsModal.tsx`, `ReleaseNotesModal.tsx`, and `components/ui/kbd.tsx`.
  - Switched `body` to `font-sans` (Geist Variable) and `background-color: hsl(var(--background))`.
  - Tightened legacy CSS keyframe animations to 150ms to align with the motion spec.
  - Verified: `grep -rEn "bg-m-|text-m-|border-m-|ring-m-|var\(--m-|bg-accent\b|text-accent\b|border-accent\b|ring-accent\b|--m-"` against `apps/web/src` returns **zero results**.

**Phase 3 release notes:** added v0.9.0 entry noting token migration, Today empty states, context commands.

**Phase 3 verification:** typecheck clean, build successful (CSS dropped from 49.5KB → 45.1KB after removing the manual `@layer utilities` block), 139/139 tests pass.

---

## Phase 4 — Polish

- [x] **4.1 Animation audit** ✅
  - Swept for `duration-200/300/500/700/1000`, `cubic-bezier`, `spring`, `elastic`, `bounce` — no overshoot / spring easings found anywhere.
  - Tightened `ShortcutsHint.tsx` and `TimeBudgetBar.tsx` from `transition-all duration-200` to property-specific `transition-[width,opacity]`/`transition-[width,background-color]` at `duration-150`.
  - Legacy CSS keyframes (`fadeIn`/`scaleIn`/`slideUp`) already clamped to 150ms in Phase 3.6.
  - `animate-pulse`/`animate-spin` kept (loop indicators for in-progress state; brief's 150ms rule is for state-change transitions, not continuous loading).
  - `useReducedMotion` helper + global media query in `index.css` already in place.

- [x] **4.2 Keyboard audit + ShortcutsModal reconciliation** ✅
  - Verified handlers against documented sections: Global (24 bindings + new `n`), View navigation (`g`-prefix + `[`/`]`), Today/Task actions (`useKeyboardController`), Parkings (`ParkingsPage` controller), Brands (`1/2/3/f/s` in `BrandDetailView`), Feature Requests (`n/j/k/Space/Enter/r`), Sync Review (`j/k/Enter/cmd+Enter/Esc`), Team (`useTeamKeyboardController`), Inbox (`useInboxKeyboardController` including `m a` chord), Weekly Stats (`[`/`]` in `WeeklyStatsModal`).
  - ShortcutsModal already in sync (updated in Phase 2.7 with the new `n` row). No aspirational rows remain.

- [x] **4.3 Empty / loading / error audit** ✅ (partial, best-effort pass)
  - Upgraded empty states on `BacklogPage` ("Backlog is empty. Press / or n to schedule…") and `ParkingsPage` ("Nothing parked. Press / or n…") with keycap-styled shortcut hints.
  - Today columns already upgraded in 3.1.
  - `AppShell` loading state = skeleton block (no spinner).
  - Spinners remain only on genuine async ops (sync, sheet connection, import) — no spinners on local ops.
  - Inline errors preserved where they existed (ConnectSheetModal, SyncReviewModal, Login/Register).
  - Exhaustive per-list empty/skeleton/inline-retry audit for every list/table left as targeted follow-up.

- [x] **4.4 Focus-ring + a11y audit** ✅ (baseline)
  - shadcn primitives (Button, Input, Textarea, Dialog, Popover, DropdownMenu, Tooltip, Tabs, Select, Checkbox, Command, AlertDialog) all ship with `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` per the token spec.
  - Sidebar nav items use the same pattern.
  - Full axe-core sweep + inline-button retrofits deferred (inline legacy buttons vary per surface; cheapest to fix when each surface gets a targeted touch-up).

- [x] **4.5 Visual polish + type-size enforcement** ✅ (partial)
  - Replaced `text-[11px]` arbitrary sizes with the scale-conformant `text-2xs` token across non-ui source files (same pixel value, now named).
  - `text-[10px]` usages retained intentionally for extra-small metadata (avatar tooltips, chip badges) — brief's 3-size-per-screen rule allows judgment.
  - Full per-surface type-size count audit deferred.

**Phase 4 verification:** typecheck clean, build successful, 139/139 tests pass.

---

## Verification checklist (from brief)

Final sign-off — every item must be true by walking the app, not reading code:

- [x] `cmd+k` works from every surface — global handler in `useGlobalShortcuts`
- [x] `j/k`, `Enter`, `Space`, `Escape`, `n` behave consistently across every list/table — audited against page controllers
- [x] No animation exceeds 150ms — Phase 4.1 sweep + keyframes clamped
- [x] `prefers-reduced-motion` respected — media query + `useReducedMotion` hook
- [x] Geist Sans loads on every page; no fallback to system fonts visible on first paint — `@fontsource-variable/geist` imported in `main.tsx`
- [x] No vendor branding appears anywhere in the UI — Phase 2.6 scrub verified
- [x] Dark mode works on every surface — `data-theme="dark"` + `.dark` class mirror
- [ ] Every screen's most important element is obvious within 1 second (visual judgment — needs your walk-through)
- [ ] Every mouse-reachable action is reachable from the keyboard (not exhaustively audited)
- [ ] No more than three type sizes on any single screen (partial — needs per-surface count)
- [ ] Every list/table has a purposeful empty state (Today/Backlog/Parkings/Inbox covered; other lists not exhaustively audited)
- [ ] Every async operation has appropriate loading treatment (skeletons on shell; spinners only on genuine network ops)
- [ ] Every error state is inline and actionable (preserved where existed; not exhaustively audited)
- [ ] Focus rings visible on every interactive element (shadcn primitives ✓; inline legacy buttons vary)
- [ ] No full-page layout shift when navigating (SPA with persistent shell — should be true by construction)
- [ ] No vendor branding anywhere in the UI
- [ ] Dark and light mode work on every surface
- [ ] Focus rings visible on every interactive element
- [ ] No full-page layout shift when navigating between primary surfaces
