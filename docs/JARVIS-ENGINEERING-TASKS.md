# Jarvis V1 — Engineering Tasks

This doc is the source of truth for the V1 Jarvis build. One task per session. Check
boxes as tasks ship. If mid-task you discover scope needs to grow or shrink, stop and
surface the change — do not silently expand.

Before starting any task, read `apps/api/src/jarvis/CLAUDE.md` (installed in Task 1)
and `docs/MOMENTUM-JARVIS-SPEC.md`. If a decision is ambiguous, the guardrails file
wins over the spec.

---

### [x] Task 1: Install guardrails, static context, and project pointer

**Goal:** The foundational files that every future Jarvis session depends on are in
place, and the project-root `CLAUDE.md` points at them.
**Scope:**

- Copy `docs/JARVIS-ARCHITECTURE-GUARDRAILS.md` verbatim to
  `apps/api/src/jarvis/CLAUDE.md`.
- Copy `docs/OMNIREV-CONTEXT.md` verbatim to
  `apps/api/src/jarvis/knowledge/omnirev-context.md`.
- Append one line to the root `CLAUDE.md` pointing future sessions at
  `apps/api/src/jarvis/CLAUDE.md` before touching Jarvis code.
- Leave the `docs/` originals in place as historical reference.
- If Nader approved any spec edits from the planning session, apply them to
  `docs/MOMENTUM-JARVIS-SPEC.md` in the same commit and note the changes in
  `docs/JARVIS-TODOS.md`.
  **Files:**
- `apps/api/src/jarvis/CLAUDE.md` (new)
- `apps/api/src/jarvis/knowledge/omnirev-context.md` (new)
- `CLAUDE.md` (root — one-line pointer added)
- `docs/MOMENTUM-JARVIS-SPEC.md` (only if spec edits approved)
  **Depends on:** none
  **Out of scope:** any code. No schema, no tools, no routes yet.

### [x] Task 2: Drizzle schema + migration for the three Jarvis tables

**Goal:** `jarvis_conversations`, `jarvis_messages`, `jarvis_tool_calls` exist in the
DB with migrations, types exported from `packages/db`.
**Scope:**

- Add tables to `packages/db/src/schema.ts` following the existing conventions (uuid
  PKs via `defaultRandom()`, timestamptz `created_at`/`updated_at`, `metadata: jsonb`
  with `.default('{}').notNull()`).
- `jarvis_messages.content` is `jsonb` (Anthropic content-block format).
- `jarvis_messages.intent` is nullable text (reserved for V1.5 router — stays empty
  in V1).
- FK cascade: `jarvis_messages → jarvis_conversations`, `jarvis_tool_calls →
jarvis_messages`.
- Enum for `role`: `user | assistant | tool`.
- Generate migration via `pnpm db:generate`, apply locally via `pnpm db:migrate`.
- Export table types from `packages/db/src/index.ts` if the existing pattern
  requires it.
  **Files:**
- `packages/db/src/schema.ts`
- `packages/db/drizzle/<new-migration>.sql` (generated)
- `packages/db/src/index.ts` if re-exports are used
  **Depends on:** Task 1
  **Out of scope:** repository functions, seed data, tool handlers, any API route.

### [x] Task 3: Tool registry skeleton + first three tools

**Goal:** The registry pattern exists; `getMyTasks`, `getBrand`,
`getBrandsRequiringAttention` run against the DB with tests.
**Scope:**

- `apps/api/src/jarvis/tools/types.ts`: `Tool<TInput, TOutput>`, `ToolContext`
  (`{ userId, now, db, logger }` — no `userRole`), `ToolTimeoutError`,
  `ToolExecutionError`.
- `apps/api/src/jarvis/tools/index.ts`: `registerTool()`, `getTool()`,
  `getAllTools()`, `executeTool()` with the 5-second timeout enforcement.
- `apps/api/src/jarvis/tools/tasks.ts`: `getMyTasks` handler.
- `apps/api/src/jarvis/tools/brands.ts`: `getBrand` handler.
- `apps/api/src/jarvis/tools/analytical.ts`: `getBrandsRequiringAttention` handler
  (server-computed composite, documented scoring formula).
- Each tool: input Zod schema, output type, description following the
  "Use when / Returns / Do not use for / Prefer" template.
- Unit tests colocated (`tasks.test.ts`, etc.) using the mock-db helper at
  `apps/api/src/test/mock-db.ts`.
  **Files:**
- `apps/api/src/jarvis/tools/{types,index,tasks,brands,analytical}.ts`
- `apps/api/src/jarvis/tools/{tasks,brands,analytical}.test.ts`
- `apps/api/src/jarvis/tools/index.test.ts` (registry + timeout)
  **Depends on:** Task 2
  **Out of scope:** the orchestrator, the LLM, the remaining 11 tools, any API route.

### [x] Task 4: Anthropic SDK wrapper + non-streaming tool-use loop

**Goal:** A `JarvisService.handleMessage()` that accepts a user message, runs the
Anthropic tool-use loop with the three tools from Task 3, and returns the final
assistant text. No DB persistence, no SSE. Proves the loop mechanics work.
**Scope:**

- `apps/api/src/jarvis/llm-provider.ts`: `LLMProvider` interface,
  `AnthropicProvider` implementation. Reads `ANTHROPIC_API_KEY` from env.
- Provider supports both non-streaming and streaming calls (streaming used in
  Task 6).
- `apps/api/src/jarvis/orchestrator.ts`: `handleMessage()` runs the loop
  (LLM call → tool_use blocks → execute tools → tool_result → re-call → repeat
  until `end_turn`). Loop cap of 8, total timeout 30s.
- Uses the static `SYNTHESIS_PROMPT_V1` constant (minimal version — dynamic
  rosters come in Task 9).
- Integration test with mocked Anthropic SDK + mock-db asserts a happy-path
  two-tool-call flow terminates.
  **Files:**
- `apps/api/src/jarvis/llm-provider.ts`
- `apps/api/src/jarvis/orchestrator.ts`
- `apps/api/src/jarvis/prompts/synthesis.ts` (with `SYNTHESIS_PROMPT_V1` — static
  preamble only for now)
- `apps/api/src/jarvis/orchestrator.test.ts`
  **Depends on:** Task 3
  **Out of scope:** persistence, streaming, SSE, API routes, dynamic prompt content
  (rosters), additional tools beyond the three from Task 3.

### [x] Task 5: Persist conversations, messages, tool calls

**Goal:** Orchestrator writes every turn to DB. Messages stored in Anthropic content
format so replay works. Tool calls land in `jarvis_tool_calls`.
**Scope:**

- `apps/api/src/jarvis/persistence/{conversations,messages,tool-calls}.ts` — thin
  repo functions (create, list-by-user, get-by-id-with-ownership-check, insert
  message, insert tool call, soft-archive conversation).
- Orchestrator loads last 20 messages as history, maps `jarvis_messages.content`
  back into Anthropic content-block shape for the next LLM call.
- On error mid-loop, partial messages are still persisted with `error: {...}`.
- Unit tests per repo file.
  **Files:**
- `apps/api/src/jarvis/persistence/{conversations,messages,tool-calls}.ts`
- matching `.test.ts` files
- `apps/api/src/jarvis/orchestrator.ts` (extended)
  **Depends on:** Task 4
  **Out of scope:** SSE, API routes, streaming.

### [x] Task 6: Fastify routes + SSE streaming

**Goal:** Five routes under `/api/jarvis` exist, authenticated, and the `POST
/messages` route streams via SSE. First token reaches the client in <1.5s on a
warm path.
**Scope:**

- `apps/api/src/jarvis/api/routes.ts`: register the five endpoints from spec §6
  (create, list, get-by-id, post-message-streaming, delete).
- Wire into the main server via the existing `app.register()` convention. Add auth
  hook `app.addHook('preHandler', app.authenticate)`.
- Shared Zod schemas for Jarvis requests/responses in
  `packages/shared/src/jarvis.ts`, re-exported from the package index.
- `apps/api/src/jarvis/api/streaming.ts`: SSE helpers (`writeEvent`, `closeStream`,
  keep-alive). Use `reply.hijack()` to take control of the socket; write raw
  `text/event-stream`.
- Orchestrator gains a `streamMessage()` variant that emits the event types from
  spec §6 (`intent`, `tool_call_start`, `tool_call_end`, `text_delta`, `done`,
  `error`).
- `intent` event is emitted as a no-op marker for V1 (empty string) — preserves
  client shape for V1.5 router.
- Integration test using Fastify `inject` against a mocked provider covering:
  create conversation, post message, stream events back, delete conversation.
  **Files:**
- `apps/api/src/jarvis/api/{routes,streaming}.ts`
- `apps/api/src/jarvis/orchestrator.ts` (extended with streaming)
- `packages/shared/src/jarvis.ts`
- `packages/shared/src/index.ts` (re-export)
- `apps/api/src/jarvis/api/routes.test.ts`
- Register routes in wherever the main Fastify app composes route modules (check
  `apps/api/src/index.ts`).
  **Depends on:** Task 5
  **Out of scope:** frontend, remaining tools, dynamic prompt content, evals.

### [x] Task 7: Frontend scaffold — route, sidebar entry, conversation list, API client

**Goal:** `/jarvis` renders as a full page with the left-rail conversation list and a
placeholder main area. Sidebar gets a Jarvis entry. Data loading via TanStack Query
against the real API.
**Scope:**

- New top-level route in `apps/web/src/App.tsx` → `<Route path="jarvis"
element={<JarvisPage />} />` nested inside the authenticated `AppShell`.
- `apps/web/src/layout/Sidebar.tsx`: add Jarvis nav item with a lucide icon (decide
  `Sparkles` vs alternatives; see TODOs).
- `apps/web/src/jarvis/JarvisPage.tsx`: layout shell (left 240px rail + main area +
  empty state placeholder).
- `apps/web/src/jarvis/ConversationList.tsx`: renders rows with title + relative
  timestamp. `j/k` navigation handled via page-scoped hook (Task 11).
- `apps/web/src/jarvis/api/*.ts`: TanStack Query hooks matching the existing
  `apps/web/src/api/hooks/` naming (`useConversations`, `useConversation`,
  `useCreateConversation`, `useDeleteConversation`).
- `@momentum/shared` imports for Jarvis request/response types.
- Empty state: 4–6 example prompts as clickable cards (static data for now; they
  create a new conversation with that initial message when clicked — handler
  wired in Task 8).
- Component tests for ConversationList.
  **Files:**
- `apps/web/src/App.tsx`
- `apps/web/src/layout/Sidebar.tsx`
- `apps/web/src/jarvis/{JarvisPage,ConversationList,EmptyState}.tsx`
- `apps/web/src/jarvis/api/{conversations,messages}.ts`
- `apps/web/src/jarvis/*.test.tsx`
  **Depends on:** Task 6
  **Out of scope:** composer, message rendering, streaming client, tool-call pills,
  keyboard shortcuts (beyond routing).

### [x] Task 8: Composer + streaming message rendering + tool-call inline pills

**Goal:** You can send a message, watch text stream in, see tool calls as animated
pills, and click a pill to see arguments + result. End-to-end Jarvis works for real
users.
**Scope:**

- `apps/web/src/jarvis/Composer.tsx`: textarea with auto-size, `Enter`/`Shift+Enter`
  behavior, send button, disabled state while a turn is in flight.
- `apps/web/src/jarvis/MessageList.tsx`: user-bubble + assistant-markdown
  rendering. Existing markdown renderer if one is in use; otherwise `react-markdown`
  (small dep — log as addition in release notes).
- `apps/web/src/jarvis/ToolCallPill.tsx`: collapsed "→ Looking up Boudin's action
  items..." state with animated dots; checkmark on `tool_call_end`; expand on
  click to show arguments + result.
- `apps/web/src/jarvis/streamMessage.ts`: fetch-based SSE reader using
  `ReadableStream`. `EventSource` does not support auth headers, and Momentum uses
  Bearer tokens — fetch-stream is the right primitive. Parses the six SSE event
  types and dispatches to a message-state reducer.
- Optimistic append on send; reconcile on `done`. Inline retry button on `error`.
- Component tests for the streaming reducer (pure function) and ToolCallPill.
  **Files:**
- `apps/web/src/jarvis/{Composer,MessageList,ToolCallPill,streamMessage}.{ts,tsx}`
- `apps/web/src/jarvis/messageReducer.ts` + test
- `apps/web/src/jarvis/JarvisPage.tsx` (wired together)
  **Depends on:** Task 7
  **Out of scope:** keyboard shortcuts (next task), remaining tools, dynamic prompt
  content, evals.

### [x] Task 9: Remaining 11 tools + dynamic prompt construction

**Goal:** All 14 V1 tools exist with tests. System prompt is assembled at
turn-construction time with team-roster and brand-portfolio injection, Omnirev
context from the static file, and split cache breakpoints.
**Scope (tools):**

- Tasks: `getTasks`, `getTaskById`.
- Team: `getTeamMembers`, `getMemberTasks`. (Note: `getTeamMemberByName` is
  dropped per approved spec edit — captured in TODOs.)
- Brands: `getBrands`, `getBrandActionItems`, `getBrandMeetings`.
- Action items: `getActionItems`, `getOverdueActionItems`.
- Meetings: `getRecentMeetings`, `getMeeting`.
- Each with Zod input schema, handler, description, colocated test.
  **Scope (prompt construction):**
- `apps/api/src/jarvis/knowledge/loader.ts`: loads
  `knowledge/omnirev-context.md` at startup, caches in memory, hot-reloads in dev.
- `apps/api/src/jarvis/prompts/synthesis.ts`: exports `SYNTHESIS_PROMPT_V1` built
  from a static block (role + behavior + formatting + tool-use guidance + Omnirev
  static context) and a dynamic block (identity + date + team roster + brand
  portfolio). The orchestrator composes both on every turn with two Anthropic
  cache breakpoints — `ephemeral` cache only on the static block and the tool
  definitions.
- Startup assertion: if the static prompt + tool-definitions exceeds the 2000
  token cap, throw loudly.
- Team and brand roster queries happen once per turn (not per tool call). No
  in-memory cache in V1 (per guardrails).
  **Files:**
- `apps/api/src/jarvis/tools/{tasks,team,brands,action-items,meetings}.ts`
  (extended)
- `apps/api/src/jarvis/tools/*.test.ts`
- `apps/api/src/jarvis/knowledge/loader.ts` + test
- `apps/api/src/jarvis/prompts/synthesis.ts` (rewritten)
- `apps/api/src/jarvis/orchestrator.ts` (prompt assembly updated)
  **Depends on:** Task 8
  **Out of scope:** the router (deferred to V1.5), evals, observability polish.
  **Natural split:** if this task runs long, split as "9a: remaining tools" and
  "9b: dynamic prompt construction + caching".

### [x] Task 10: Observability polish — cost, structured logs, `jarvis_tool_calls` analytics

**Goal:** Every turn produces the structured log line from spec §9. Per-turn cost
computed from `token_usage`. Tool-level latency/success queryable.
**Scope:**

- `apps/api/src/jarvis/observability/pricing.ts`: model pricing lookup (Sonnet 4.6
  input/output/cache-read/cache-creation costs). Captures units clearly.
- `apps/api/src/jarvis/observability/logger.ts`: emits the structured log shape on
  every turn completion using the existing Momentum logger (do not introduce a
  new logging framework).
- `jarvis_messages.token_usage` populated from every assistant turn.
- `jarvis_tool_calls` populated from every tool execution (rows contain both
  successful and failed calls).
- Unit test for pricing math.
  **Files:**
- `apps/api/src/jarvis/observability/{pricing,logger}.ts` (+ tests)
- `apps/api/src/jarvis/orchestrator.ts` (wire logger)
  **Depends on:** Task 9
  **Out of scope:** admin dashboard, real-time cost alerts (capture in TODOs).

### [ ] Task 11: Keyboard shortcuts + `g j` chord + ShortcutsModal update

**Goal:** All Jarvis-page keybindings work. Global `g j` chord navigates to
`/jarvis`. ShortcutsModal documents the Jarvis section.
**Scope:**

- `apps/web/src/jarvis/hooks/useJarvisKeyboardController.ts`: page-scoped (bails
  on wrong pathname and on focused inputs). Handles `n`, `/`, `Enter` /
  `Shift+Enter` / `Cmd+Enter`, `Esc` (two-stage), `j/k` when list is focused.
- Invoked from `JarvisPage`.
- `apps/web/src/hooks/useGlobalShortcuts.ts`: add `g j` → `navigate('/jarvis')`
  to the existing g-prefix chord table.
- `apps/web/src/modals/ShortcutsModal.tsx`: add a new "Jarvis" section enumerating
  every binding above (per root CLAUDE.md rule — any binding added =
  ShortcutsModal updated in the same change).
- Component tests for the hook's pathname-bail behavior.
  **Files:**
- `apps/web/src/jarvis/hooks/useJarvisKeyboardController.ts` + test
- `apps/web/src/hooks/useGlobalShortcuts.ts`
- `apps/web/src/modals/ShortcutsModal.tsx`
- `apps/web/src/jarvis/{JarvisPage,Composer}.tsx` (wiring)
  **Depends on:** Task 8 (UI components must exist to bind against)
  **Out of scope:** conversation-list reordering, list search (captured in TODOs).

### [ ] Task 12: Eval harness + 20 starter cases + CI wiring

**Goal:** `pnpm jarvis:eval` runs all cases against a seeded test DB and emits a
pass-rate report. CI runs on PR open + merge to main; fails below 90%.
**Scope:**

- `apps/api/src/jarvis/evals/cases.json`: 20 cases per the spec §10 distribution
  (8 task / 4 brand / 3 team / 3 analytical / 2 out-of-scope).
- `apps/api/src/jarvis/evals/runner.ts`: loads cases, drives the orchestrator
  against a seeded test DB, asserts intent / tool-calls / forbidden phrases.
  **Intent assertions are skipped in V1** since the router is deferred; the field
  is left in the case format for V1.5.
- Seed fixture: minimal set of users, brands, tasks, action items, meetings.
- `package.json` script at the api-app level: `"jarvis:eval": "vitest run
src/jarvis/evals/runner.ts"` (or standalone if cleaner).
- GitHub Actions job (or whatever CI config is used — check `.github/workflows/`
  at task start) that runs the eval on PRs touching `apps/api/src/jarvis/**` or
  `apps/web/src/jarvis/**`.
- Fails CI at <90% pass.
  **Files:**
- `apps/api/src/jarvis/evals/{cases.json,runner.ts,fixtures.ts}`
- `apps/api/package.json` (new script)
- `.github/workflows/*.yml` (jarvis-eval job)
  **Depends on:** Task 9, Task 10
  **Out of scope:** production monitoring dashboards, eval leaderboards, prompt
  auto-tuning.

### [ ] Task 13: Empty / loading / error polish + release notes + README + TODO.md update

**Goal:** Jarvis feels production-ready. Every failure mode has a graceful path.
Release notes entry explains the feature. README reflects the new top-level surface.
**Scope:**

- Loading skeleton for `ConversationList` matching the expected row layout.
- Inline error rendering with retry when a stream fails mid-turn (reuses the
  error handling from Task 8; refine copy).
- Graceful timeout message when the 30s total-turn timeout fires.
- Empty state for the conversation list (no conversations yet) — short prompt +
  keycap hint.
- `apps/web/src/lib/releaseNotes.ts`: prepend a new version entry per Momentum's
  release-notes rule, with `shortcuts` arrays for the new bindings and a `howTo`
  line pointing at `/jarvis`.
- `README.md`: stack list updated (Anthropic SDK added), feature list updated,
  first-run steps updated if `ANTHROPIC_API_KEY` becomes a required env var.
- `.env.example`: add `ANTHROPIC_API_KEY=`.
- `docs/TODO.md`: remove anything that just shipped.
  **Files:**
- `apps/web/src/jarvis/*` (polish across files)
- `apps/web/src/lib/releaseNotes.ts`
- `README.md`
- `.env.example`
- `docs/TODO.md`
  **Depends on:** Task 12
  **Out of scope:** anything in `docs/JARVIS-TODOS.md` under "Deferred from spec" or
  "Ideas surfaced during planning".

---

## Parking lot — not on the V1 build sequence

Anything that would otherwise slip into one of the tasks above but doesn't belong in
V1 goes to `docs/JARVIS-TODOS.md`. Do not pad scope. If you find yourself thinking
"while I'm here...", that's the signal to capture in TODOs and move on.
