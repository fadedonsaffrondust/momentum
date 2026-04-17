# Momentum

Momentum started as a keyboard-first daily task operating system for founders and operators who wear multiple hats. It has since grown into a broader daily execution + relationship surface for people running a company — still keyboard-first, still opinionated, now with client management, meeting capture, and feature-request triage built in.

The product is organized around a few load-bearing ideas:

1. **Today-only by default.** Tasks opens to what you're doing today; everything else is one key away.
2. **Keyboard-first, everywhere.** Every screen has its own shortcut layer. Press `?` for the full map.
3. **Context-aware.** Tasks belong to "roles" (the hats you wear) and can be filtered to one at a time.
4. **Time-boxed.** Every task has a time estimate; the day tells you when it's overloaded.
5. **Opinionated ritual.** Plan My Day, End of Day Review, daily standup Parkings, and per-brand meeting logs drive a workflow, not just a list.

### What's in it today

- **Tasks** — the original Today / Backlog / Done surface with roles, priorities, estimates, and daily rituals.
- **Parkings** — capture topics to raise at your next daily standup, grouped by day, with prep notes and outcomes.
- **Brands** — full client/relationship management: North Star (goals + stakeholders), Pulse (health, open action items), Archive (meeting notes with auto-extracted action items), bidirectional sync to the Today view, and AI-assisted import from raw notes.
- **Meeting recording sync** — pull recordings from tldv per brand, score candidates against stakeholder emails and matching rules, and auto-extract summaries / action items / decisions. Duplicates are deduped against existing action items via an LLM pass.
- **Feature Requests** — per-brand tab that two-way-syncs with a Google Sheet. Inline edit, filter/search, convert to action items.
- **What's new** — release notes that auto-open on update; an accent dot on the sidebar flags unseen releases.

See [`docs/CLAUDE-CODE-PROMPT.md`](./docs/CLAUDE-CODE-PROMPT.md) for the original product spec, [`docs/MOMENTUM-BRANDS-FEATURE-SPEC.md`](./docs/MOMENTUM-BRANDS-FEATURE-SPEC.md), [`docs/MOMENTUM-TLDV-SYNC-SPEC.md`](./docs/MOMENTUM-TLDV-SYNC-SPEC.md), and [`docs/MOMENTUM-FEATURE-REQUESTS-SPEC.md`](./docs/MOMENTUM-FEATURE-REQUESTS-SPEC.md) for the newer surfaces, and [`docs/KEYBOARD-SHORTCUTS-REFERENCE.md`](./docs/KEYBOARD-SHORTCUTS-REFERENCE.md) for the shortcut contract.

---

## Tech stack

| Layer | Choice |
|---|---|
| **Monorepo** | pnpm workspaces + Turborepo |
| **Language** | TypeScript (strict, `noUncheckedIndexedAccess`, ESM everywhere) |
| **Frontend** | React 18, Vite, Tailwind CSS (semantic `m.*` token namespace), TanStack Query, Zustand, React Router, cmdk, react-hotkeys-hook |
| **Backend** | Node.js 20+, Fastify 5, `fastify-type-provider-zod`, `@fastify/jwt`, bcryptjs |
| **Integrations** | OpenAI (brand import, action-item dedup, meeting extraction), tldv (meeting recordings), Google Sheets via `googleapis` (feature requests two-way sync) |
| **Database** | PostgreSQL 16 |
| **ORM / migrations** | Drizzle ORM + drizzle-kit, postgres.js driver |
| **Shared contracts** | Zod schemas in `packages/shared` — single source of truth for types shared between web and api |
| **Testing** | Vitest in every package (~360+ tests); Fastify `.inject()` + a mock-db helper at `apps/api/src/test/mock-db.ts` for route tests |
| **Tooling** | Prettier, tsx (dev + runtime), Turbo for task orchestration |

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
- **pnpm 10+** — enable via Corepack: `corepack enable pnpm`
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

| Variable | Enables |
|---|---|
| `OPENAI_API_KEY` | AI brand import from `.md` / `.txt` notes, meeting summary / action-item extraction during recording sync, LLM-based action-item deduplication |
| `TLDV_API_KEY` | "Sync Recordings" on a brand — pulls recordings from tldv and processes transcripts |
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

On first visit the web client walks you through a short first-run wizard (name → roles → daily capacity) and then drops you into the Today view. Press `?` or open the command palette (`Cmd/Ctrl + K` → "Keyboard Shortcuts") for the full list of bindings.

---

## Scripts

All scripts are run from the repo root and delegated to the appropriate workspace by Turborepo.

| Command | What it does |
|---|---|
| `pnpm dev` | Run the API and web in watch mode concurrently |
| `pnpm build` | Build all packages (typecheck + vite production bundle) |
| `pnpm typecheck` | Type-check the whole monorepo |
| `pnpm test` | Run the Vitest suites across every package |
| `pnpm lint` | Lint |
| `pnpm format` | Prettier-format every file |
| `pnpm db:generate` | Generate a new Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations against `DATABASE_URL` |
| `pnpm db:studio` | Launch Drizzle Studio for inspecting the database |
| `pnpm --filter @momentum/api dev` | Run just the API |
| `pnpm --filter @momentum/web dev` | Run just the web client |

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
