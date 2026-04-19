# Momentum

Momentum started as a keyboard-first daily task operating system for founders and operators who wear multiple hats. As of **v0.7.0** it is the shared operating system for the Omnirev team — tasks, parkings, brands, and meetings are team-visible, everyone has an Inbox for work that involves them, and a new Team Task View surfaces who's doing what right now. The single-user rituals (Plan My Day, End of Day Review, Weekly Stats) stay personal; the relationship surface is shared.

The product is organized around a few load-bearing ideas:

1. **Today-only by default.** Tasks opens to what you're doing today; everything else is one key away.
2. **Keyboard-first, everywhere.** Every screen has its own shortcut layer. Press `?` for the full map.
3. **Context-aware.** Tasks belong to "roles" (the hats the team wears) and can be filtered to one at a time.
4. **Time-boxed.** Every task has a time estimate; the day tells you when it's overloaded.
5. **Opinionated ritual.** Plan My Day, End of Day Review, daily standup Parkings, and per-brand meeting logs drive a workflow, not just a list.
6. **One team, one space.** Momentum hosts a single team — Omnirev. Signup is restricted to `@omnirev.ai`; the domain allowlist is the tenant boundary (there is no multi-tenancy layer).

### What's in it today

- **Tasks** — Today / Backlog / Done with roles, priorities, estimates, and daily rituals. Every task has a creator and an assignee; filter by **Mine / Everyone / Unassigned**, reassign with `A`, or inline-assign with `@alice` in the quick-add bar.
- **Parkings** — capture topics for the next daily standup. Team-visible by default; flip to private with `v`, or tag teammates into a parking with `I` to put it in their Inbox.
- **Brands** — full client/relationship management across the team: North Star (goals + stakeholders), Pulse (health, open action items), Archive (meeting notes + auto-extracted action items), bidirectional sync to Today, AI-assisted import, and a Recent Activity feed per brand.
- **Meeting recording sync** — pull recordings from tldv per brand, score candidates against stakeholder emails and matching rules, and auto-extract summaries / action items / decisions. Attendees that match teammate emails are auto-linked.
- **Feature Requests** — per-brand tab that two-way-syncs with a Google Sheet. Inline edit, filter/search, convert to action items.
- **Team Task View** (`g u`) — everyone's Today grouped by teammate, with the same keyboard-first kanban flow as the personal Today view.
- **Inbox** (`g i`) — the five events that involve you: tasks assigned to you, your tasks edited, parkings that tag you, action items assigned to you, meetings you were added to.
- **End of Day team pulse + Weekly Stats Team tab** — your personal review stays private; a quiet strip in EOD and a Team tab in Weekly Stats surface team signal without competing with personal rituals.
- **What's new** — release notes that auto-open on update; an accent dot on the sidebar flags unseen releases.

See [`docs/CLAUDE-CODE-PROMPT.md`](./docs/CLAUDE-CODE-PROMPT.md) for the original product spec, [`docs/MOMENTUM-TEAM-SPACE-SPEC.md`](./docs/MOMENTUM-TEAM-SPACE-SPEC.md) for the v0.7.0 team-space rewrite, [`docs/MOMENTUM-BRANDS-FEATURE-SPEC.md`](./docs/MOMENTUM-BRANDS-FEATURE-SPEC.md), [`docs/MOMENTUM-TLDV-SYNC-SPEC.md`](./docs/MOMENTUM-TLDV-SYNC-SPEC.md), and [`docs/MOMENTUM-FEATURE-REQUESTS-SPEC.md`](./docs/MOMENTUM-FEATURE-REQUESTS-SPEC.md) for the relationship surfaces, and [`docs/KEYBOARD-SHORTCUTS-REFERENCE.md`](./docs/KEYBOARD-SHORTCUTS-REFERENCE.md) for the shortcut contract.

---

## Tech stack

| Layer                | Choice                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo**         | pnpm workspaces + Turborepo                                                                                                                             |
| **Language**         | TypeScript (strict, `noUncheckedIndexedAccess`, ESM everywhere)                                                                                         |
| **Frontend**         | React 18, Vite, Tailwind CSS (semantic `m.*` token namespace), TanStack Query, Zustand, React Router, cmdk, react-hotkeys-hook                          |
| **Backend**          | Node.js 20+, Fastify 5, `fastify-type-provider-zod`, `@fastify/jwt`, `@fastify/helmet`, `@fastify/rate-limit`, bcryptjs                                 |
| **Integrations**     | OpenAI (brand import, action-item dedup, meeting extraction), tldv (meeting recordings), Google Sheets via `googleapis` (feature requests two-way sync) |
| **Database**         | PostgreSQL 16                                                                                                                                           |
| **ORM / migrations** | Drizzle ORM + drizzle-kit, postgres.js driver                                                                                                           |
| **Shared contracts** | Zod schemas in `packages/shared` — single source of truth for types shared between web and api                                                          |
| **Testing**          | Vitest in every package (~360+ tests); Fastify `.inject()` + a mock-db helper at `apps/api/src/test/mock-db.ts` for route tests                         |
| **Tooling**          | ESLint (flat config), Prettier, lefthook (pre-commit), tsx (dev + runtime), Turbo for task orchestration                                                |

### Repo layout

```
apps/
  web/          React + Vite SPA               (@momentum/web)
  api/          Fastify HTTP API               (@momentum/api)
packages/
  shared/       Zod schemas + quick-add parser (@momentum/shared)
  db/           Drizzle schema + migrations    (@momentum/db)
docs/           Product specs, engineering tasks, shortcut reference
```

---

## Running from scratch

### 1. Prerequisites

- **Node.js 20+** (`.nvmrc` pins to 20; `node -v`)
- **pnpm 10.33.0+** — enable via Corepack: `corepack enable pnpm` (the version is pinned via `packageManager` in every workspace and enforced via `engine-strict=true` in `.npmrc`)
- **PostgreSQL 16** — either:
  - **Docker** (recommended): Docker Desktop or Colima, then `docker compose up -d postgres` spins one up via the included `docker-compose.yml`, **or**
  - **Local install** (e.g. Homebrew): `brew install postgresql@17 && brew services start postgresql@17`, then create the role and database manually:
    ```bash
    psql -d postgres -c "CREATE ROLE momentum WITH LOGIN PASSWORD 'momentum' CREATEDB;"
    psql -d postgres -c "CREATE DATABASE momentum OWNER momentum;"
    ```

### 2. Clone and install

```bash
git clone <this repo> momentum
cd momentum
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set `JWT_SECRET` to a long random string. The defaults for `DATABASE_URL`, ports, and CORS match the Docker Compose service and the Vite dev server, so they work unchanged in local development.

The following variables are optional — the app runs fine without them, but the associated features are gated:

| Variable                     | Enables                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`             | AI brand import from `.md` / `.txt` notes, meeting summary / action-item extraction during recording sync, LLM-based action-item deduplication                 |
| `TLDV_API_KEY`               | "Sync Recordings" on a brand — pulls recordings from tldv and processes transcripts                                                                            |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Feature Requests two-way sync with Google Sheets. Paste the full JSON key as a single-line string, and share the target sheet with the service account's email |

### 4. Start the database

```bash
# With Docker:
docker compose up -d postgres

# Or with a local Postgres (see Prerequisites above) — no command needed
# once the service is running and the momentum role/db exist.
```

### 5. Apply migrations

```bash
pnpm db:migrate
```

This runs the SQL in `packages/db/drizzle/` against `DATABASE_URL`.

### 6. Start the dev servers

```bash
pnpm dev
```

Turborepo boots the API and web client concurrently:

- Web: <http://localhost:5173>
- API: <http://localhost:3001>
- Healthcheck: <http://localhost:3001/health>

On first visit the web client walks you through a short first-run wizard (display name → daily capacity) and then drops you into the Today view. Signup is gated to the `@omnirev.ai` domain; the role palette is team-wide (new signups inherit whatever Nader and Mikael seeded), so only the display name and capacity are per-user. Press `?` or open the command palette (`Cmd/Ctrl + K` → "Keyboard Shortcuts") for the full list of bindings.

---

## Scripts

All scripts are run from the repo root and delegated to the appropriate workspace by Turborepo.

| Command                           | What it does                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                        | Run the API and web in watch mode concurrently                 |
| `pnpm build`                      | Build all packages (typecheck + vite production bundle)        |
| `pnpm typecheck`                  | Type-check the whole monorepo                                  |
| `pnpm test`                       | Run the Vitest suites across every package                     |
| `pnpm lint`                       | Lint every workspace with ESLint (`--max-warnings=0`)          |
| `pnpm format`                     | Prettier-format every file                                     |
| `pnpm format:check`               | Verify Prettier formatting without writing (matches CI's gate) |
| `pnpm db:generate`                | Generate a new Drizzle migration from schema changes           |
| `pnpm db:migrate`                 | Apply pending migrations against `DATABASE_URL`                |
| `pnpm db:studio`                  | Launch Drizzle Studio for inspecting the database              |
| `pnpm --filter @momentum/api dev` | Run just the API                                               |
| `pnpm --filter @momentum/web dev` | Run just the web client                                        |

---

## Contributing

Quality gates run automatically. On every pull request and on pushes to `main`, GitHub Actions runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and `pnpm build`. The workflow is at [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

Locally, a [lefthook](https://lefthook.dev/) pre-commit hook installs automatically when you run `pnpm install` (via the root `prepare` script). It auto-fixes ESLint and Prettier issues on staged `.ts` / `.tsx` / `.json` / `.md` files so formatting never blocks review. To bypass the hook for a single commit (e.g. WIP), prefix with `LEFTHOOK=0`.

---

## Troubleshooting

- **`DATABASE_URL` errors at startup** — you forgot `cp .env.example .env`, or the `.env` at the repo root is missing the variable. The API and the migration runner both read the root `.env`.
- **Migration fails with `role "momentum" does not exist`** — the database hasn't been created. See the Prerequisites step for the `CREATE ROLE` / `CREATE DATABASE` commands, or use `docker compose up -d postgres` which handles this via the compose environment.
- **Web shows a perpetual "Loading…"** — the API can't reach Postgres. If you're on a local Homebrew install, check `brew services list` and look for a stale `postmaster.pid` under the data dir.
- **Brand import / recording sync fails silently** — check `OPENAI_API_KEY` / `TLDV_API_KEY` are set in `.env` and restart the API (`tsx watch` doesn't always pick up `.env` changes).
- **Google Sheets sync returns a permission error** — the target sheet must be shared with the service account email from `GOOGLE_SERVICE_ACCOUNT_KEY` (the `client_email` field in the JSON).
- **Port 5173 or 3001 already in use** — kill the process with `lsof -ti:5173 | xargs kill` (likewise for 3001), or change `API_PORT` / Vite's port in `apps/web/vite.config.ts`.
- **`pnpm: command not found`** — `corepack enable pnpm` (Node 20+ ships Corepack).

---

See [`CLAUDE.md`](./CLAUDE.md) for project conventions and the rules that Claude Code follows when working in this repo.
