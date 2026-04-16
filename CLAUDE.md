# Momentum — Claude Project Guide

Momentum is a keyboard-first daily task operating system for startup founders and operators. See `docs/CLAUDE-CODE-PROMPT.md` for the product spec and `docs/KEYBOARD-SHORTCUTS-REFERENCE.md` for the shortcut contract.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend (`apps/web`):** React 18 + Vite + TypeScript, TanStack Query, Zustand, Tailwind CSS, React Router, cmdk
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
- No CSS-in-JS; Tailwind + CSS variables only.
- No global Redux; Zustand only for UI state, TanStack Query for server state.

## Data model (summary)

See `packages/db/src/schema.ts` for the source of truth. Tables: `users`, `roles`, `tasks`, `daily_logs`, `user_settings`. Task has `status` (`todo|in_progress|done`), `column` (`up_next|in_progress|done`), `scheduled_date`, `estimate_minutes`, `actual_minutes`, `priority`.

## Deployment

Not wired up yet. `docker-compose.yml` boots postgres for local dev only.
