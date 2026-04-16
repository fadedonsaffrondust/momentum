# Momentum

Momentum is a keyboard-first daily task operating system for startup founders and operators who wear multiple hats and need to move fast. It is not a traditional todo list — it is an opinionated daily execution engine built around five ideas:

1. **Today-only by default.** The primary view shows only what you're doing today.
2. **Keyboard-first.** Every action is reachable without the mouse.
3. **Context-aware.** Tasks belong to "roles" (the hats you wear) and can be filtered to one at a time.
4. **Time-boxed.** Every task has a time estimate; the app tells you when your day is overloaded.
5. **Opinionated daily ritual.** Plan My Day and End of Day Review flows drive a workflow, not just a list.

See [`docs/CLAUDE-CODE-PROMPT.md`](./docs/CLAUDE-CODE-PROMPT.md) for the full product spec and [`docs/KEYBOARD-SHORTCUTS-REFERENCE.md`](./docs/KEYBOARD-SHORTCUTS-REFERENCE.md) for the keyboard shortcut contract.

---

## Tech stack

| Layer | Choice |
|---|---|
| **Monorepo** | pnpm workspaces + Turborepo |
| **Language** | TypeScript (strict, ESM everywhere) |
| **Frontend** | React 18, Vite, Tailwind CSS, TanStack Query, Zustand, React Router, cmdk, react-hotkeys-hook |
| **Backend** | Node.js, Fastify 5, `fastify-type-provider-zod`, `@fastify/jwt`, bcryptjs |
| **Database** | PostgreSQL 16 |
| **ORM / migrations** | Drizzle ORM + drizzle-kit, postgres.js driver |
| **Shared contracts** | Zod schemas in `packages/shared` — the single source of truth for types shared between web and api |
| **Tooling** | Prettier, tsx (dev server + runtime), Node's built-in test runner |

### Repo layout

```
apps/
  web/          React + Vite SPA               (@momentum/web)
  api/          Fastify HTTP API               (@momentum/api)
packages/
  shared/       Zod schemas + quick-add parser (@momentum/shared)
  db/           Drizzle schema + migrations    (@momentum/db)
docs/           Product spec & shortcut reference
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

Then open `.env` and set `JWT_SECRET` to a long random string. The defaults for `DATABASE_URL`, ports, and CORS match the Docker Compose service and the Vite dev server, so they work unchanged in local development.

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
| `pnpm test` | Run tests (includes the shared-package parser tests) |
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
- **Port 5173 or 3001 already in use** — kill the process with `lsof -ti:5173 | xargs kill` (likewise for 3001), or change `API_PORT` / Vite's port in `apps/web/vite.config.ts`.
- **`pnpm: command not found`** — `corepack enable pnpm` (Node 20+ ships Corepack).

---

See [`CLAUDE.md`](./CLAUDE.md) for project conventions and the rules that Claude Code follows when working in this repo.
