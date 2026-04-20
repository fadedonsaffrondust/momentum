# Jarvis V1 — Technical Specification

**Audience:** Claude Code (implementation agent)
**Owner:** Nader
**Status:** Spec, ready to build
**Stack:** React SPA + Fastify/Node API + Postgres + Drizzle ORM
**LLM provider:** Anthropic (Claude Sonnet 4.6 via official SDK)

---

## 0. Read this first

Before writing any code, complete Build Step 0 in Section 11. Two files in the `docs/` folder must be copied into the codebase as the foundation for everything that follows:

1. `docs/JARVIS-ARCHITECTURE-GUARDRAILS.md` → `apps/api/src/jarvis/CLAUDE.md` — standing architectural rules, patterns to refuse, and escalation triggers. Mandatory reading for every future Claude Code session that touches Jarvis.
2. `docs/OMNIREV-CONTEXT.md` → `apps/api/src/jarvis/knowledge/omnirev-context.md` — the static Omnirev context injected into every Jarvis prompt.

Additionally, append a one-line pointer to the existing project-root `CLAUDE.md` so top-level Claude Code sessions know Jarvis has its own rules:

> Jarvis has its own architectural guardrails — see `apps/api/src/jarvis/CLAUDE.md` before modifying any Jarvis code.

Do not start the data model work until all three installs are complete. When you are uncertain whether a design choice is correct during the build, the guardrails file is the first reference; this spec is the second.

This is a monorepo. Backend Jarvis code lives under `apps/api/src/jarvis/`. Frontend Jarvis code lives under `apps/web/src/jarvis/` (or wherever the web app's existing feature-folder convention places it — match existing patterns in `apps/web/src/`).

---

## 1. Context and goal

Jarvis is a new top-level surface in Momentum: a navbar destination that opens a full-page conversational interface where any logged-in user can ask natural-language questions about their work, their team's work, and the state of brand accounts.

V1 is **read-only**. The user asks questions; Jarvis answers by calling structured tools over Momentum's existing data. No data is created, modified, or deleted in V1. Action capability ("create a task for Sara") is explicitly Phase 2 and must not be partially built into V1.

The architecture must be designed so that adding Phase 2 actions, additional data sources (CRM, email, Slack), and a real RAG-backed knowledge base in later phases is a matter of **registering new tools and providers** — not refactoring core orchestration.

---

## 2. Architectural overview

Jarvis is a tool-using agent over Momentum's own data. It has four logical layers, each with a single responsibility:

**Layer 1 — Orchestrator (`JarvisService`).** Owns the conversation loop. Receives a user message, assembles ambient context, invokes the LLM with the tool registry, runs the tool-call loop until the model produces a final answer, streams output back to the client, and persists the conversation. (A dedicated intent-router pass is deferred to V1.5 — see §12.)

**Layer 2 — Retrieval.** Two distinct subsystems:

- **Tool registry** for structured data — typed functions over Momentum's database, executed deterministically when the LLM calls them.
- **Knowledge service** for unstructured Omnirev context — in V1, this is a single static markdown file injected into the system prompt. The interface is built so that V1.5 can swap it for vector search without changing callers.

**Layer 3 — Prompt library.** Versioned system prompts stored in code, one per use case (synthesis; future: action confirmation). Treated as code artifacts: PR-reviewed, eval-tested.

The flow on every Jarvis call:

```
user message
  → orchestrator
  → context assembler (ambient context + scoped retrieval)
  → LLM call with tool registry
  → tool-call loop (LLM may call 0..N tools)
  → final answer streamed to client
  → conversation persisted
```

---

## 3. Data model

Three new tables. All use the existing Momentum conventions for IDs (assume `cuid` or `uuid` per current codebase), timestamps (`created_at`, `updated_at`), and soft delete if used elsewhere. Use Drizzle schema definitions matching the rest of the codebase.

### `jarvis_conversations`

A single conversation thread, owned by one user.

| Field         | Type                  | Notes                                                    |
| ------------- | --------------------- | -------------------------------------------------------- |
| `id`          | uuid (PK)             |                                                          |
| `user_id`     | uuid (FK → users)     | Owner of the conversation                                |
| `title`       | text                  | Auto-generated from first message; user can rename later |
| `created_at`  | timestamptz           |                                                          |
| `updated_at`  | timestamptz           | Bumped on every new message                              |
| `archived_at` | timestamptz, nullable | Soft archive for hiding from main list                   |
| `metadata`    | jsonb, default `{}`   | Reserved for future fields (pinned, tags, sharing)       |

### `jarvis_messages`

Individual messages within a conversation. Stores both user messages and assistant responses, including tool calls and tool results.

| Field             | Type                              | Notes                                                         |
| ----------------- | --------------------------------- | ------------------------------------------------------------- |
| `id`              | uuid (PK)                         |                                                               |
| `conversation_id` | uuid (FK → jarvis_conversations)  | Cascade delete                                                |
| `role`            | enum: `user`, `assistant`, `tool` | `tool` for tool-result messages in the loop                   |
| `content`         | jsonb                             | Anthropic-format content blocks (text, tool_use, tool_result) |
| `intent`          | text, nullable                    | Router classification, only on user messages                  |
| `model`           | text, nullable                    | LLM model used, only on assistant messages                    |
| `latency_ms`      | integer, nullable                 | End-to-end latency for assistant turns                        |
| `token_usage`     | jsonb, nullable                   | `{input_tokens, output_tokens, cache_read, cache_creation}`   |
| `error`           | jsonb, nullable                   | Captured error details if the turn failed                     |
| `created_at`      | timestamptz                       |                                                               |
| `metadata`        | jsonb, default `{}`               | Reserved                                                      |

Storing content as Anthropic-format `jsonb` (rather than plain text) means the full assistant turn — including tool calls and results — is replayable for debugging and forms the conversation history sent on subsequent turns. This is non-negotiable for tool-using agents.

### `jarvis_tool_calls`

Denormalized log of every tool call for observability and analytics. Not strictly required for runtime behavior — the tool calls are recoverable from `jarvis_messages.content` — but having them as a flat queryable table makes "what tools fail most" and "what's slow" trivial questions to answer.

| Field        | Type                        | Notes                                       |
| ------------ | --------------------------- | ------------------------------------------- |
| `id`         | uuid (PK)                   |                                             |
| `message_id` | uuid (FK → jarvis_messages) | The assistant message that issued this call |
| `tool_name`  | text                        | e.g., `getBrandHealth`                      |
| `arguments`  | jsonb                       | The arguments passed                        |
| `result`     | jsonb, nullable             | The tool's return value, or null on error   |
| `error`      | text, nullable              | Error message if the tool threw             |
| `latency_ms` | integer                     | Tool execution time                         |
| `created_at` | timestamptz                 |                                             |

### Reserved `customFields` and schema versioning

Per Momentum's architecture principles, each table includes a `metadata` jsonb slot for forward-compatible extensions. Any data export from Jarvis surfaces must include a top-level `schemaVersion` field; start at `1`.

---

## 4. Tool registry

The tool registry is the heart of the system. Tools are typed, registered through a single `registerTool()` call, and exposed to the LLM as Anthropic tool definitions.

### Registry contract

```ts
type Tool<TInput, TOutput> = {
  name: string; // Unique identifier, also the function name LLM calls
  description: string; // What it does and when to use it (LLM reads this)
  inputSchema: JSONSchema; // Anthropic tool input schema
  readOnly: true; // V1 invariant — all tools are read-only
  handler: (args: TInput, ctx: ToolContext) => Promise<TOutput>;
};

type ToolContext = {
  userId: string;
  now: Date;
  db: DrizzleClient;
  logger: Logger;
};
```

`readOnly: true` is enforced as a literal type in V1 — it's the marker we'll flip to `false | "with-confirmation"` in Phase 2. Don't make this field optional.

### V1 tool list

Fourteen tools across five categories. Each tool's description should follow this template: _"Use when the user asks about X. Returns Y. Do not use for Z."_ Sharp tool descriptions are the single biggest lever on tool-call accuracy — invest the time.

**Task tools**

- `getMyTasks(dateRange?, status?)` — current user's tasks. Use when user says "my tasks", "what am I doing", "what's on my plate".
- `getTasks(assigneeId?, dateRange?, status?, brandId?)` — tasks across team. Use when querying about tasks not owned by the asker.
- `getTaskById(taskId)` — single task detail.

**Team tools**

- `getTeamMembers()` — list all team members with role.
- `getMemberTasks(memberId, dateRange?, status?)` — tasks for a specific member.

_(A `getTeamMemberByName` fuzzy-lookup tool was considered and dropped from V1 — the full team roster is inlined into every system prompt, so the model resolves names to IDs directly without a tool call. Re-introduce if the roster ever grows past the size we can inline in ~200 tokens.)_

**Brand tools**

- `getBrands(filters?)` — list brands with current health, owner, last activity timestamp.
- `getBrand(brandId)` — single brand: full summary including recent meetings, open action items count, owner, health.
- `getBrandActionItems(brandId, status?)` — action items for a brand.
- `getBrandMeetings(brandId, dateRange?, limit?)` — meetings for a brand.

**Action item tools**

- `getActionItems(filters)` — flexible cross-brand query (assignee, status, brand, due_before).
- `getOverdueActionItems(assigneeId?)` — convenience for "what's overdue".

**Meeting tools**

- `getRecentMeetings(limit?, brandId?)` — most recent meetings across all brands or scoped to one.
- `getMeeting(meetingId)` — single meeting with notes and extracted action items.

**Analytical tools**

- `getBrandsRequiringAttention()` — server-computed: brands sorted by composite of health, days since last touch, count of overdue action items. Returns a ranked list with reasons. This is the one tool that does meaningful logic on the backend rather than returning raw rows — the LLM should not be doing this math.

### Tool implementation rules

1. **All tools accept `ToolContext`.** No tool reads global state. The user identity always comes from `ctx.userId`.
2. **All tools return JSON-serializable shapes.** No Date objects (use ISO strings), no class instances, no functions.
3. **All tools log via `ctx.logger`.** Successful calls log at `info`; errors at `error`. The orchestrator will additionally insert into `jarvis_tool_calls`.
4. **All tools have a hard timeout** of 5 seconds. If a tool exceeds this, throw a structured `ToolTimeoutError`. The orchestrator catches this and returns a tool_result message indicating the timeout, so the LLM can decide whether to retry or report failure.
5. **No tool exposes internal IDs the user wouldn't recognize without context.** Return `{id, name, ...}` shapes; never bare IDs.

### Permissions — V1 model

V1 uses the simplest possible permission model: **any authenticated Momentum user can call any tool and see the data it returns.** Tools always include `userId` in `ToolContext` so this can be tightened later, but no scoping logic is built in V1.

This is a deliberate scope decision flagged in the founder playbook. If Nader changes his mind on this before build starts, every tool gains a permission-check step.

---

## 5. Prompt library

System prompts live in `src/jarvis/prompts/` as `.ts` files exporting versioned constants. Format:

```ts
export const SYNTHESIS_PROMPT_V1 = `...`;
```

When a prompt is revised meaningfully, bump the version: `SYNTHESIS_PROMPT_V2`. Keep prior versions in the file for at least one release for diffing and rollback. The orchestrator imports the active version by name.

### Synthesis prompt (V1)

The main system prompt that frames the assistant. Structured as:

1. **Role.** "You are Jarvis, the internal AI assistant for Omnirev's leadership team. You answer questions about brands, tasks, action items, meetings, and team workflow by calling tools over Momentum's database."
2. **Identity context.** Injected dynamically on every turn: current user's name and role, current date.
3. **Team Roster.** Injected dynamically on every turn. Queried from the `team_members` table at prompt-construction time. Compact format: `- {name} ({id}) — {role}`. Gives the model awareness of who exists without needing a tool call to discover them.
4. **Brand Portfolio.** Injected dynamically on every turn. Queried from the `brands` table at prompt-construction time. Compact format: `- {name} ({id}) — {segment}, owner: {owner_name}`. Gives the model awareness of what brands exist and their basic attributes, so queries like "how is Boudin" resolve directly to the right brand ID in one tool call instead of two.
5. **Omnirev context.** A compact paragraph describing Omnirev's business — mission, ICP, GTM motion, current strategic focus. **Static only.** Loaded from `apps/api/src/jarvis/knowledge/omnirev-context.md`. Does NOT contain brand list, team roster, or any other content that exists as live data in Momentum's DB.
6. **Behavior rules.** Always call tools to ground claims about data. Never fabricate task names, dates, or counts. If a tool returns nothing, say so clearly. **When a user's question asks about something registered tools cannot access (e.g., platform usage or revenue data when those tools don't yet exist), explicitly state which signals you can and cannot see, and answer confidently based on the available data. Never dodge and never fabricate the missing pieces.** Be concise — this is an internal operator tool, not a chatbot.
7. **Output formatting.** Use compact prose. Use lists only when listing 3+ items. Reference brand and person names in `**bold**`. Always cite source: when you mention a task or action item, include its ID in parentheses so the user can find it.
8. **Tool-use guidance.** A short section reminding the model to prefer specific tools over generic ones (use `getMyTasks` instead of `getTasks` with self filter), to call tools in parallel when independent, and to use the inlined rosters above to resolve names to IDs directly rather than making extra lookup calls.

Total system prompt budget: ≤2000 tokens including injected rosters. If it grows past this, push content into tools rather than the prompt. Budget allocation guide: ~400 tokens for role + behavior + formatting + tool-use guidance; ~200 tokens for team roster (sized for ~10 team members); ~300 tokens for brand portfolio (sized for ~20 brands); ~400 tokens for Omnirev static context; remaining headroom absorbs growth.

### Prompt construction flow

On every turn, the prompt builder:

1. Loads the static Omnirev context file from disk (cached after first load; hot-reloaded in dev).
2. Queries `team_members` → formats into the Team Roster section.
3. Queries `brands` → formats into the Brand Portfolio section.
4. Substitutes all sections into the template.
5. Passes the resulting system prompt to the LLM with `cache_control: { type: "ephemeral" }`.

The DB queries in steps 2 and 3 are the only blocking DB access in the orchestrator. They happen once per turn (not per tool call). For V1, do not add an in-memory cache layer — the queries are fast and correctness matters more than latency. If team/brand roster queries become a measurable bottleneck post-launch, introduce a short TTL cache (60 seconds) at that point, not before.

### Static knowledge file (V1)

`apps/api/src/jarvis/knowledge/omnirev-context.md` — a single markdown file containing **only content that does not live in Momentum's database.** This file is for truly static Omnirev context; dynamic entity data (brands, team members, tasks, etc.) is pulled live from the DB and injected separately.

Contents:

- Omnirev's mission and product (1 paragraph)
- The catering vertical and ICP (1 paragraph)
- Go-to-market motion (1 paragraph)
- Current strategic focus for the quarter (1 paragraph, updated quarterly)
- Any other non-confidential strategic context useful for synthesis that is not already represented as data

**Explicitly NOT in this file:** brand portfolio list, team roster, product feature list, or anything else that exists as queryable data in Momentum. Putting dynamic data in this file causes drift between the context Jarvis sees and reality, which is catastrophic for trust. If you're tempted to add a list of brands or team members here, resist — it comes from the DB at prompt-construction time (see prompt construction flow above).

Loaded at server startup, cached in memory, hot-reloaded on file change in dev. Inserted into the synthesis prompt as the "Omnirev context" section. **No vector search, no chunking, no embeddings in V1.**

---

## 6. Backend API (Fastify routes)

Five routes under `/api/jarvis`. All require authentication via existing Momentum auth middleware.

### `POST /api/jarvis/conversations`

Create a new conversation. Optionally accepts an initial message in the body.

Request: `{ initialMessage?: string }`
Response: `{ conversationId: string, title: string }`

If `initialMessage` is provided, the title is generated from its first 60 characters; otherwise a placeholder. (LLM-summarized titles are deferred — see `docs/JARVIS-TODOS.md`.)

### `GET /api/jarvis/conversations`

List the current user's conversations, paginated, ordered by `updated_at desc`. Returns id, title, message count, last message preview, timestamps.

### `GET /api/jarvis/conversations/:id`

Returns full conversation: metadata + ordered messages. Owner-only — 404 if the conversation belongs to a different user.

### `POST /api/jarvis/conversations/:id/messages`

The main endpoint. Accepts a user message, runs the full Jarvis loop, **streams the response** back to the client.

Request: `{ content: string }`
Response: SSE (Server-Sent Events) stream with these event types:

- `intent` — router classification result (emitted as an empty string in V1; router deferred to V1.5, see §12)
- `tool_call_start` — `{ tool_name, arguments }`
- `tool_call_end` — `{ tool_name, latency_ms, success }`
- `text_delta` — `{ text }` (partial assistant text)
- `done` — `{ message_id, total_latency_ms, token_usage }`
- `error` — `{ message }`

Streaming is mandatory. Latency from first token must be under 1.5 seconds for trust.

### `DELETE /api/jarvis/conversations/:id`

Soft delete (sets `archived_at`). Owner-only. Hard delete is V1.5.

---

## 7. Orchestrator implementation rules

The `JarvisService.handleMessage(conversationId, userMessage)` method:

1. Load conversation history from DB (last N messages — see context budget below).
2. Build the synthesis system prompt, injecting current user identity, team members, Omnirev context. (Intent classification is deferred to V1.5; `jarvis_messages.intent` is left nullable in V1 for forward compatibility.)
3. Construct the Anthropic API call with: system prompt, conversation history (mapped from `jarvis_messages.content`), the new user message, and the full tool registry.
4. Stream the response. For each tool-use block, execute the tool, append a tool_result block to the conversation, and re-call the API with the tool result included. Loop until the model returns a stop_reason of `end_turn`.
5. Persist all messages (user, each assistant turn, each tool message). Persist tool calls to `jarvis_tool_calls`.
6. Emit SSE events to the client throughout.

### Context window budget

Sonnet 4.6 has a large context window but cost and latency scale with input tokens. Apply these limits:

- **Conversation history**: include the last 20 messages, or until 30k tokens, whichever is smaller.
- **System prompt**: hard-cap at 2000 tokens (enforced at startup; fail loud if a new prompt exceeds this).
- **Tool results**: if a single tool returns > 50KB of data, truncate to first 10 results and indicate truncation in the result. Tools should also have sensible default limits (no `getActionItems` without a date or status filter returning all items ever).

### Tool-call loop safety

- Hard maximum: **8 sequential tool calls per turn.** If the model exceeds this, the orchestrator returns a final assistant message saying "I'm having trouble finding what you need, can you rephrase?" and logs it as a `tool_loop_exhausted` error.
- Per-tool timeout: 5 seconds (enforced in the registry).
- Total turn timeout: 30 seconds. After that, return a graceful timeout error to the client.

### Caching

Use Anthropic's prompt caching with two cache breakpoints per call:

1. **Static system prompt block** — role, behavior rules, output formatting, tool-use guidance, and the Omnirev static context. Changes only on deploy. Mark with `cache_control: { type: "ephemeral" }`.
2. **Tool definitions array** — the full tool registry serialized for Anthropic. Also marked `cache_control: { type: "ephemeral" }`.

The **dynamic block** — current user identity, current date, team roster, and brand portfolio — is rebuilt fresh every turn and is NOT cached. Splitting the prompt this way pins the ~80% of tokens that never change in the stable cache while letting rosters be reconstructed whenever brands or team members change. A single-block design would bust the cache on every roster change, which for an active Omnirev could happen daily.

Track cache token usage (`cache_creation_input_tokens`, `cache_read_input_tokens`) in `token_usage`.

---

## 8. Frontend

A new top-level route, `/jarvis`, accessible from the navbar. Single full-page chat surface.

### Layout

- **Left rail (240px):** Conversation list. Search input at top. "New conversation" button (also bound to `Cmd+N` from this page). Each row shows title and a relative timestamp.
- **Main area:** Active conversation. Messages flow top-to-bottom. Composer pinned to the bottom.
- **Empty state:** When no conversation is open, show 4-6 example prompts as clickable cards ("What are my tasks for today?", "How is Boudin doing?", "Which brand needs the most attention?", "What did I do this week?").

### Message rendering

- **User messages:** Right-aligned, simple text bubble.
- **Assistant messages:** Left-aligned, rendered as markdown (so `**bold**` for names works). Code blocks supported.
- **Tool calls:** Rendered inline as collapsed status pills _between_ user and assistant messages: `→ Looking up Boudin's action items...` (animating dots while in flight, checkmark when done). Click to expand and see arguments + result. This is critical for trust — users see exactly what data was fetched.
- **Streaming text:** Token-by-token rendering with a blinking cursor at the end while streaming.

### Keyboard shortcuts (aligned with Momentum's keyboard architecture)

The root `CLAUDE.md` establishes cross-surface canonicals — `?` opens the shortcuts modal, `Cmd+K` opens the command palette, `/` and `n` focus input / create — and reserves `Cmd+N/R/W/P` as browser-conflicting bindings that always pair with a `g`-prefix alias. Jarvis's bindings must respect those rules:

- `n` — new conversation (when no input has focus). From any page, the global `g j` chord navigates to `/jarvis`; add `g j` to the existing g-prefix chord table and to the `ShortcutsModal`.
- `/` — focus the composer (when no input has focus).
- `Enter` — send message. `Shift+Enter` — newline. `Cmd+Enter` — alternate send.
- `Esc` — first press blurs the composer; second press returns focus to the conversation list.
- `j` / `k` — navigate the conversation list when it's focused.
- `?` — opens the existing global `ShortcutsModal`, which gains a new "Jarvis" section enumerating every binding above.

Do NOT introduce `Cmd+N`, `Cmd+K`, or `Cmd+/` bindings: the first two collide with the browser and the existing global palette respectively, and `?` already covers the shortcut-help role.

### Streaming UX rules

- First token must reach the client in <1.5s. If it takes longer, show a "Thinking..." indicator after 800ms.
- Tool call status pills appear immediately on `tool_call_start`. Don't batch.
- If the stream errors mid-response, render whatever was received plus a clear error inline. Provide a "Retry" button that re-sends the last user message.

### State management

Conversations are server-authoritative. The frontend fetches list and individual conversations as needed; no client-side caching beyond React Query (or whatever the rest of Momentum uses for server state). Optimistic message append on send; reconcile with server's persisted message ID on `done`.

---

## 9. Observability

Every Jarvis turn produces a structured log line:

```
{
  conversation_id,
  user_id,
  intent,
  tool_calls: [{ name, latency_ms, success }, ...],
  total_latency_ms,
  token_usage: { input, output, cache_read, cache_creation },
  cost_estimate_usd,
  model,
  status: "success" | "error" | "timeout",
  error?: string
}
```

Cost estimation: maintain a small lookup of model pricing in `src/jarvis/pricing.ts`; compute per-turn cost from `token_usage`. This makes the founder playbook's cost monitoring trivial.

Logs go through Momentum's existing logger. Persist to `jarvis_tool_calls` for tool-level analytics; persist token usage and latency on `jarvis_messages` for turn-level analytics.

---

## 10. Eval framework

Build a minimal but real eval harness in `src/jarvis/evals/`. This is not optional — it's the difference between Jarvis getting better over time and silently regressing.

### Structure

`evals/cases.json` — array of test cases, each:

```json
{
  "id": "tasks-001",
  "input": "What are my tasks for today?",
  "as_user": "nader",
  "expected_intent": "data_query",
  "expected_tool_calls": ["getMyTasks"],
  "answer_must_contain": [],
  "answer_must_not_contain": ["I don't know", "I cannot"]
}
```

The harness runs each case end-to-end against a test database seeded with deterministic fixtures, then asserts:

- Intent matched (when specified) — **skipped in V1** while the router is deferred; the `expected_intent` field stays in the case format so V1.5 can switch it on without rewriting fixtures.
- Required tool calls all happened (in any order)
- Forbidden phrases absent from response

### V1 starter set

Ship with **20 hand-authored cases** covering the main query types:

- 8 task queries (mine, others, by date, by status)
- 4 brand queries (single brand summary, brand list, brand health, action items)
- 3 team queries (who is X, what is Y working on)
- 3 analytical queries (which brand needs attention, what's overdue)
- 2 out-of-scope queries (should refuse gracefully)

### CI integration

Run evals on every change to anything under `src/jarvis/`. Fail the build if pass rate drops below 90%. Don't run on every commit (cost) — run on PR open and on merge to main.

---

## 11. Build sequence

This is the order Claude Code should follow. Each step is independently verifiable.

0. **Install architecture guardrails and context file:**
   - Copy the contents of `docs/JARVIS-ARCHITECTURE-GUARDRAILS.md` into a new file at `apps/api/src/jarvis/CLAUDE.md`. This is the standing instruction file for every future Claude Code session. Do not modify the content during install.
   - Copy the contents of `docs/OMNIREV-CONTEXT.md` into a new file at `apps/api/src/jarvis/knowledge/omnirev-context.md`. This will be loaded into every Jarvis prompt as static context.
   - Append a one-line pointer to the existing project-root `CLAUDE.md` (a "Subsystem-specific guardrails" section, or append to an existing relevant section): `Jarvis has its own architectural guardrails — see \`apps/api/src/jarvis/CLAUDE.md\` before modifying any Jarvis code.`
   - After this step, the working source of truth for the guardrails and context is the copy in the code, not the copy in `docs/`. Leave the `docs/` versions in place as historical reference.
1. **Data model:** Drizzle schema for the three new tables, migration, basic CRUD repository functions.
2. **Tool registry skeleton:** Registry interface, `ToolContext`, in-memory registration. No tools yet, but the system can boot.
3. **First three tools:** `getMyTasks`, `getBrand`, `getBrandsRequiringAttention`. End-to-end tested against seeded data.
4. **Anthropic SDK integration:** Service that takes a message and runs a tool-use loop with Sonnet 4.6, no streaming yet, no DB persistence — just verify the loop works.
5. **Persistence:** Wire conversation/message storage into the loop. `POST /messages` returns the full response (no streaming).
6. **Streaming:** Convert to SSE. Frontend can stream into a simple test page at this point.
7. **Frontend chat surface:** `/jarvis` route, conversation list, message rendering, composer. Wire to streaming endpoint.
8. **Tool call inline rendering:** Status pills for tool calls in the chat.
9. **Remaining 11 tools:** Implement and test each. (`getTeamMemberByName` was dropped from the V1 list — the inlined team roster makes it redundant.)
10. **Knowledge file injection:** Static markdown into system prompt.
11. **Keyboard shortcuts:** Full set per spec.
12. **Eval harness + 20 starter cases:** Run, ensure ≥90% pass.
13. **Observability polish:** Cost estimation, structured logging, tool_calls table population.
14. **Empty state, error states, edge cases:** Loading skeletons, retry flows, timeout handling.

_(A dedicated router pass — a V1.5 item — is deliberately absent from this sequence; see §12.)_

Steps 1-6 are the critical path. After step 6, you have a working (if ugly) Jarvis. Everything after is making it good.

---

## 12. Explicitly out of scope for V1

The following are deliberately deferred. **Do not build them, even partially.** Building stubs creates surface area that has to be maintained or removed later.

- **Dedicated intent-router pass.** A separate LLM call to classify every incoming message as `data_query | knowledge_query | analytical | out_of_scope` is deferred to V1.5. V1 exposes the full tool registry on every turn and leaves `jarvis_messages.intent` nullable. The router adds a full network round-trip before first token and, as an advisory-only label in V1, does not earn its cost; we keep the column so V1.5 can backfill or switch it on without a migration.
- **Any write/mutation tools.** No `createTask`, no `updateActionItem`, nothing that changes data. Phase 2.
- **Vector search / RAG.** Knowledge is a flat file in V1.
- **Fine-grained permissions.** Any authenticated user can ask anything. V1.5 if Nader pushes back.
- **Scheduled / proactive Jarvis.** No "Jarvis sends you a daily summary." That's a separate feature.
- **Multi-modal input.** No file uploads, no images.
- **Sharing conversations.** Conversations are private to their owner.
- **Hard delete.** Archive only.
- **Custom tool selection by user.** The model picks tools; users don't.
- **Multiple LLM providers.** Anthropic only. The provider abstraction exists for future flexibility but only one implementation ships.
- **Voice input/output.** Not now.
- **Mobile-optimized layout.** Desktop only for V1.

---

## 13. Confirmed V1 architectural decisions

The following decisions were reviewed and locked by Nader before handoff. Do not revisit these mid-build without explicit conversation with Nader; they are load-bearing for the rest of the spec.

1. **Permission model: any authenticated Momentum user can call any tool and see the data it returns.** Tools accept `userId` in `ToolContext` for future flexibility, but no user-scoping logic is built in V1. This reflects that Momentum is an internal tool for a peer-level leadership team operating on shared brand accounts — there is no concrete current scenario requiring restriction. If a restriction scenario emerges post-launch, the permission layer goes in the orchestrator (applied uniformly), not in individual tools. See the architecture guardrails file for the refusal pattern on per-tool permission checks.

2. **Conversation visibility: strictly private to the user who created the conversation.** No sharing, no team-visible conversations, no admin read access. Endpoints that load a conversation 404 on ownership mismatch. The rationale is trust: users reveal their mental model of problems when talking to Jarvis, and the risk of silent self-censorship under a shared-by-default model outweighs the collaboration upside. Sharing may be revisited as an opt-in V2 feature if there is clear demand; it will not be retrofitted into V1.

Additional decisions confirmed earlier in the spec process and not expected to change during the build:

- **LLM provider: Anthropic only**, Claude Sonnet 4.6 via the official SDK. No multi-provider routing in V1.
- **V1 is read-only.** No write tools, no stubs, no `// TODO: implement` placeholders for future mutations.
- **Knowledge retrieval in V1 is a single flat markdown file.** No RAG, no embeddings, no vector search.
- **UI surface is a full-page navbar destination** at `/jarvis`. No command palette modal, no side panel in V1.
- **Team members already exist as a first-class entity** in Momentum. Jarvis queries the existing entity; no new team-member schema work is introduced by this spec.

Everything else in the spec can be iterated post-launch without architectural rework.
