# Momentum — Claude Project Guide

Momentum is a keyboard-first daily task operating system for startup founders and operators. See `docs/CLAUDE-CODE-PROMPT.md` for the product spec and `docs/KEYBOARD-SHORTCUTS-REFERENCE.md` for the shortcut contract.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend (`apps/web`):** React 18 + Vite + TypeScript, TanStack Query, Zustand, Tailwind CSS, React Router, cmdk, shadcn/ui + Radix primitives (copied in-repo under `src/components/ui/`), Framer Motion, Geist Sans + Geist Mono via `@fontsource-variable`, lucide-react icons
- **Backend (`apps/api`):** Fastify + TypeScript, Drizzle ORM, JWT auth, bcrypt, Zod validation
- **Database:** PostgreSQL 16 (via `docker-compose.yml`)
- **Shared (`packages/shared`):** Zod schemas + derived TS types used by both web and api — the single source of truth for data contracts
- **DB (`packages/db`):** Drizzle schema + migrations

## Repo layout

```
apps/
  web/    # React + Vite client
  api/    # Fastify server
packages/
  shared/ # Zod schemas, parser, shared types
  db/     # Drizzle schema + migrations
```

## Common commands

```bash
# First-time setup
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate

# Development (runs web + api concurrently via turbo)
pnpm dev

# Per-app
pnpm --filter @momentum/api dev
pnpm --filter @momentum/web dev

# DB
pnpm db:generate   # generate new migration from schema changes
pnpm db:migrate    # apply migrations
pnpm db:studio     # open drizzle studio

# Quality
pnpm typecheck
pnpm lint
pnpm test
pnpm format
```

## Frontend design principles

Momentum's frontend foundation was rebuilt in v0.9.0 against `docs/FRONTEND-REVISION-BRIEF.md` (the brief) and tracked in `docs/FRONTEND-TASKS.md` (per-phase execution log with deferred follow-ups). Those two files are the authoritative source. This section captures the day-to-day rules so future changes stay consistent without re-reading the brief.

**Aspiration:** Linear / Attio / Raycast / Vercel-dashboard tier. Keyboard-first, information-dense, workflow-driven. Not a generic SaaS dashboard.

### Design tokens

- **Single source of truth:** HSL triplets in `apps/web/src/index.css`, consumed via `hsl(var(--…))` through the Tailwind `colors` map in `tailwind.config.ts`. Legacy `--m-*` variables were fully removed in v0.9.0 — do not reintroduce them.
- **Semantic token names (use these in classNames):**
  - `bg-background` / `text-foreground` — page canvas + primary text
  - `bg-card` / `text-card-foreground` — elevated surface (sidebar, cards, dialogs)
  - `bg-popover` / `text-popover-foreground` — popovers, dropdowns, the command palette
  - `bg-primary` / `text-primary` / `text-primary-foreground` — **brand green** (Momentum accent); reserved for primary actions, active states, brand identity
  - `bg-secondary` / `text-secondary-foreground` — neutral alt surface; used for hover/highlighted/selected states in shadcn primitives
  - `bg-muted` / `text-muted-foreground` — subtle/disabled content; secondary text, metadata
  - `bg-accent` / `text-accent-foreground` — shadcn's neutral hover token (**intentionally not the brand color** — `primary` holds brand)
  - `bg-destructive` / `text-destructive-foreground` — error/danger; status only, never decoration
  - `border-border` / `border-input` / `ring-ring` — borders, input borders, focus rings
- **Dark mode is default.** Light mode switches via `html[data-theme="light"]`; shadcn primitives also respect `html.dark` (both selectors mirror). Toggling theme updates both.
- **Shadcn primitive gotcha:** the in-repo shadcn primitives use `bg-secondary`/`text-secondary-foreground` for hover/highlighted/selected states (canonical shadcn uses `bg-accent` for this; we substituted during install so `--accent` stays reserved as the shadcn-semantic neutral-hover slot). When adding new shadcn primitives, apply the same substitution.

### Typography

- **Fonts:** Geist Variable (UI) + Geist Mono Variable (numerics, IDs, timestamps, keycaps), loaded via `@fontsource-variable/geist*` imports in `apps/web/src/main.tsx`. Never add another font. Never re-introduce Google Fonts `<link>` tags.
- **Body default:** `font-sans` (Geist). Use `font-mono` only on numeric columns, IDs, timestamps, and `<kbd>`.
- **Scale (defined in `tailwind.config.ts`):** `text-2xs` (11/16), `text-xs` (12/18), `text-sm` (13/20), `text-base` (14/22), `text-lg` (16/24), `text-xl` (20/28), `text-2xl` (24/32). Don't use arbitrary `text-[Npx]` values — if you need something off-scale, update the scale with justification.
- **Max three type sizes on any single screen. Max two weights.** Weights allowed: `400` (default), `500` (emphasis), `600` (headers). Never `700+`.

### Spacing, radius, shadow, motion, density

- **Spacing:** 4px base grid. Prefer scale tokens (`gap-2`, `p-4`, `space-y-3`) over arbitrary values.
- **Radius:** `rounded-sm` (3px, inputs + small buttons), default `rounded` (6px, cards + default buttons), `rounded-md` (8px, dialogs + panels). **Never larger than 8px.**
- **Shadow:** `shadow-xs` (hover lift), `shadow-sm` (popovers/dropdowns), `shadow-md` (dialogs). Prefer 1px `border-border` over shadows for elevation. No shadows on buttons, inputs, or inline elements.
- **Motion:** every transition **≤150ms**. Use `transition-colors` or property-specific `transition-[width,opacity]` — **never `transition-all`**. No bounce / spring / elastic / overshoot anywhere. `apps/web/src/hooks/useReducedMotion.ts` wraps Framer Motion's hook; Framer components should read it. Global `@media (prefers-reduced-motion: reduce)` in `index.css` already flattens legacy CSS keyframes and all transitions.
- **Density:** table rows 32–36px, list rows 36–40px, buttons 28/32/36px (sm/default/lg), inputs 32px, card padding 16px (12px for compact variants).

### Component foundation

- **Reach for shadcn primitives first.** Files in `apps/web/src/components/ui/` — Button, Input, Textarea, Dialog, Popover, DropdownMenu, Tooltip, Tabs, Badge, Select, Checkbox, Command, Separator, AlertDialog, Kbd. Modify them in-repo as needed; do not install another component library (no MUI, Chakra, Ant, Mantine, etc.).
- **Radix is the behavior layer.** Dialog/Popover/DropdownMenu/Tooltip/Select/Tabs/Checkbox/Separator/AlertDialog are Radix under the hood — they handle focus trap, escape, portal, scroll lock, ARIA. Never roll your own.
- **Focus rings:** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` is the canonical pattern. shadcn primitives ship with it — never strip it.
- **Icons:** `lucide-react` only. Never emojis. Never other icon sets.
- **Path alias:** `@/*` resolves to `apps/web/src/*` (configured in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`). Use `@/lib/utils` for `cn()`, `@/components/ui/*` for primitives, `@/lib/commands/context` for the palette registry.

### Keyboard architecture

- **Global shortcuts** (`apps/web/src/hooks/useGlobalShortcuts.ts`) run in **capture phase** and `stopPropagation()` consumed keys, so page-scoped handlers never double-fire.
- **Page-scoped handlers** (`useKeyboardController`, `useTeamKeyboardController`, `useInboxKeyboardController`, and in-page `useEffect` handlers) run in bubble phase and must bail when the active element is an `INPUT`/`TEXTAREA`/contentEditable.
- **`g`-prefix chord** state machine (1500ms timeout) lives in the global handler. Navigation: `g t` → `/`, `g l` → `/backlog`, `g p` → `/parkings`, `g u` → `/team`, `g b` → `/brands`, `g i` → `/inbox`. Ritual aliases: `g d` → Plan My Day, `g r` → End of Day, `g w` → Weekly Stats (chords exist because browsers reserve `Cmd+P/R/W`).
- **`n`** = focus `[data-task-input="true"]` if present, else dispatch `new CustomEvent('momentum:new-thing')` on `window`. Page-level "new" handlers should listen for that event going forward rather than binding `n` directly.
- **Cross-surface canonicals — never reassign:** `j`/`k` navigate, `Enter` opens/confirms, `Space` toggles, `Escape` closes, `?` opens shortcuts modal, `Cmd+K` opens command palette, `/` and `n` focus input / create.
- **Focus targets:** opt in via data attributes (`[data-task-input="true"]`, `[data-person-filter="true"]`) so the global handler can discover them.
- **Always update `apps/web/src/modals/ShortcutsModal.tsx`** in the same change when you add/modify/remove a binding (full rule below in "Keep the shortcuts help in sync").

### Command palette

- **Registry pattern:** commands are registered via `useRegisterCommands(commands, deps)` from `@/lib/commands/context`. Each `Command` has `id`, `label`, `description?`, `icon?`, `shortcut?`, `section`, `priority?`, `when?(pathname)`, `run()`. Stable `id` values are required (Recents persistence is keyed by id).
- **Global commands** live in `apps/web/src/lib/commands/global.tsx` and are mounted once from `AppShell`. Page-specific commands register from the page component with a `when` predicate matching the current route (see `apps/web/src/pages/TodayPage.tsx` for the pattern).
- **Recents** persist in `localStorage` key `momentum:palette:recents:v1`, cap 5, filtered against currently-registered commands on render.
- **Shortcut hints** tokenize with spaces and render as keycaps: `"Cmd K"`, `"g t"`, `"?"`. The `Kbd` primitive renders each token.

### Empty / loading / error states

- **Every list, table, and panel has a purposeful empty state** — one line of purpose + a keycap-styled shortcut hint ("Press `/` or `n` to add one"). No illustrations. No empty-state clipart.
- **Loading:** skeleton matching the expected layout (see `AppShell` for the pattern). Never spinners on local operations — they should be instant.
- **Errors:** inline next to the thing that failed, with a Retry action. Toasts are for transient confirmations only ("Task created"), never for persistent errors that need action.
- **Workflow-first defaults:** filtered/focused landing states (Today shows today, Feature Requests defaults to Open, brand list defaults to active). "Show all" is an escape hatch, not the landing state.

### Vendor branding

- **No vendor names in the UI.** Use "recording", "sync", "AI extraction", "spreadsheet" — never "tl;dv", "Google Sheets", "OpenAI", "Slack", etc. Backend env var names (e.g., `OPENAI_API_KEY`) may stay literal in code but never in user-facing copy or release notes.

### Don't

- Don't install Material UI, Chakra, Ant Design, Mantine, or any other component library alongside shadcn.
- Don't introduce new fonts. Geist and Geist Mono only.
- Don't use `transition-all` — always name the animating properties.
- Don't use bounce / spring / elastic / overshoot easings anywhere in UI chrome.
- Don't use brand color (`primary`) for decoration — it's reserved for primary actions, active states, and brand identity.
- Don't use bright saturated colors outside of status indicators.
- Don't reintroduce `--m-*` CSS variables, the `colors.m.*` Tailwind map, or the manual `@layer utilities` scaffolding. All removed in v0.9.0.
- Don't roll your own modal, popover, dropdown, or tooltip — use Radix via the shadcn primitives.
- Don't strip the `focus-visible` ring from shadcn primitives.
- Don't use full-width content containers — use a max width with graceful shrink below it.

## Keep the shortcuts help in sync

Momentum is keyboard-first, which means `apps/web/src/modals/ShortcutsModal.tsx` is load-bearing documentation — it's where users actually discover what they can press. It is **not optional** and it drifts fast if you don't enforce the rule.

**Any time you touch `useKeyboardController.ts` (or any code that registers a keydown handler users can trigger), update `ShortcutsModal.tsx` in the same change.** This means:

- **Adding a new binding:** append a row to the correct `SECTIONS` entry. Pick the section by user-facing location, not by code structure — bindings that only fire on `/parkings` go in the Parkings section, not Global.
- **Changing an existing binding:** update the label and keys — don't leave the old row behind. If a shortcut previously did X and now does Y (e.g. `Tab` used to cycle two views and now cycles three), the label must reflect the current behavior exactly.
- **Removing a binding:** delete the row. Never leave aspirational rows for shortcuts that aren't wired up — that's how we end up with "t – Move to today" documented for two months before anyone notices it's a ghost.
- **Adding a new section:** if a new view gets its own keyboard namespace (like Parkings did), add a new section with a clear `description` telling the user when those bindings fire.

Sanity check before committing: read every row of `ShortcutsModal.tsx` and confirm the keydown handler in `useKeyboardController.ts` (or the modal-specific handler) actually matches. If you find a mismatch, that's a bug — fix the source of truth first, then the doc.

This rule applies to modal-internal shortcuts too (RolePickerModal, command palette), but those are rendered as footers inside their own modals — update the footer `<Kbd>` hints there, not the main ShortcutsModal.

## Keep release notes in sync

Momentum ships a "What's new" modal that auto-opens once per new release. The content lives in `apps/web/src/lib/releaseNotes.ts` as a typed array. **Every user-visible change must append a new entry in the same commit that introduces the change** — do not defer it, and do not bundle multiple features into one vague entry.

Rules:

- **When to add an entry:** new feature, new keyboard shortcut, changed behavior, removed feature, or any UI/UX tweak a user would notice. Pure refactors, dependency bumps, and internal cleanups don't need an entry.
- **Where:** prepend to `RELEASE_NOTES` in `apps/web/src/lib/releaseNotes.ts`. Newest first.
- **Version scheme:**
  - Bump minor (`0.X.0`) for any new feature or set of features.
  - Bump patch (`0.X.Y`) for small tweaks, bugfixes worth announcing, or shortcut additions.
  - Never reuse a version number.
- **Required fields per entry:** `version`, `date` (today's date, YYYY-MM-DD), `headline` (short punchy title), `summary` (one-sentence tl;dr), and `items[]` (one per distinct feature).
- **Per `item`:** always include `title` and `description`. Include `shortcuts` (array of keycap strings like `["Cmd", "K"]`) whenever a keyboard binding is involved. Include `howTo` when a user needs more than a description to actually try the thing — a one-liner like "Open Parkings from the sidebar and type a topic the same way you type tasks."
- **After adding the entry:** `LATEST_VERSION` is derived from `RELEASE_NOTES[0]!.version`, so you don't update it manually, but you must verify the auto-prompt logic will fire (i.e. the new version compares greater than what's in `localStorage`).
- **Also update `docs/TODO.md`** by removing items that just shipped.
- **Also update `README.md`** per the rule below if the stack, features, or setup changed.

Treat release notes as documentation the user will read — write descriptions in full sentences, not changelog fragments. The goal is that a user opening the "What's new" modal walks away knowing how to use the new feature, not just that it exists.

## Keep the README in sync

The repo-root `README.md` documents three things: **what Momentum is**, **the tech stack**, and **how to run the project from scratch**. Whenever any of those change, update `README.md` in the same change — do not defer it.

Concretely, the README must be updated when any of these happen:

- The product description or core philosophy changes (check against `docs/CLAUDE-CODE-PROMPT.md`).
- A dependency that defines the stack is added, removed, or swapped (e.g. switching from Fastify, adding a new shared package, changing the ORM, moving off PostgreSQL).
- The first-run steps change: new prerequisites, new env vars that the user must set, new setup commands, changes to default ports, or changes to the migration / seed flow.
- A top-level `package.json` script is added, removed, or renamed.
- The repo layout changes (new workspace package, renamed app, etc.).

If you're unsure whether a change is README-worthy, ask: "would a new contributor following the README hit something unexpected?" If yes, update it.

## Keep tests in sync

Every code change that adds or modifies runtime logic must include corresponding unit tests in the same commit. This applies to:

- **New functions or modules:** write tests that cover the happy path, edge cases, and error conditions.
- **Modified functions:** update existing tests to reflect the new behavior. Add new test cases for any new code paths introduced.
- **New API routes:** test business logic (state transitions, calculations, validation) with mocked DB via Fastify `.inject()` and the mock-db helper at `apps/api/src/test/mock-db.ts`.
- **New Zod schemas:** test that valid data parses and invalid data is rejected with the expected errors.
- **Bug fixes:** add a regression test that would have caught the bug before the fix.

Run `pnpm test` before committing and ensure all tests pass. Never commit with failing tests.

Test files are colocated with source: `foo.ts` → `foo.test.ts`. Use Vitest (`describe`/`it`/`expect`). For pure functions, test directly with no mocking. For functions that depend on the current date, use `vi.useFakeTimers()`. For API routes, use the mock-db helper and Fastify `.inject()`.

## Conventions

- **Data contract lives in `packages/shared`.** When the data model changes, update Zod schemas there first; both api and web import the derived types. Never duplicate shapes.
- **TypeScript strict mode everywhere.** `noUncheckedIndexedAccess` is on.
- **ESM only** (`"type": "module"` in every package).
- **API routes** live in `apps/api/src/routes/*`. Each route uses Fastify's Zod type provider for validated input/output.
- **Frontend data fetching** goes through TanStack Query hooks in `apps/web/src/api/*`. Never call `fetch` directly from components.
- **Keyboard shortcuts** are registered via a single `useKeyboardController` hook that respects context (input focus / modal open).
- **Quick-add parser** is shared code (`packages/shared/src/parser.ts`) and must remain pure so both client and server can use it.
- **Tests** use Vitest in every package. Colocated `*.test.ts` files next to source. Run via `pnpm test` (Turbo-orchestrated).

## Non-goals

- No SSR. Web is a pure SPA.
- No ORM other than Drizzle.
- No CSS-in-JS; Tailwind utilities + shadcn CSS-variable tokens only.
- No global Redux; Zustand only for UI state, TanStack Query for server state.
- No component library other than shadcn/ui (copied in-repo under `apps/web/src/components/ui/`).

## Data model (summary)

See `packages/db/src/schema.ts` for the source of truth. Tables: `users`, `roles`, `tasks`, `daily_logs`, `user_settings`. Task has `status` (`todo|in_progress|done`), `column` (`up_next|in_progress|done`), `scheduled_date`, `estimate_minutes`, `actual_minutes`, `priority`.

## Deployment

Not wired up yet. `docker-compose.yml` boots postgres for local dev only.
