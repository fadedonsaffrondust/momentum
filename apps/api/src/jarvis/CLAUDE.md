# Jarvis — Architecture Guardrails

**Install location:** `apps/api/src/jarvis/CLAUDE.md` in the Momentum repo.
**Read this every time you touch Jarvis code.** No exceptions.

This file protects the architecture from drift. The Jarvis subsystem is intentionally opinionated and tightly designed because it will eventually become the internal brain for Omnirev — connecting all data, every workflow, every team member's daily operating loop. Decisions made cheaply now will be expensive to reverse later. Treat this document with the same weight as the codebase itself.

If a user request would violate one of the hard invariants below, **push back before implementing**. Explain the rule, the reasoning, and propose an alternative that respects the architecture. Do not silently work around these rules.

---

## The architecture in 60 seconds

Jarvis is a **tool-using agent over Momentum's structured data**, with a small flat knowledge file injected into the prompt. It is not a chatbot, not a RAG system, not an autonomous agent.

Four logical layers, in this order:

1. **Orchestrator** (`src/jarvis/orchestrator.ts`). Owns the conversation loop. Receives a message, runs intent classification, assembles context, runs the tool-call loop, streams output, persists everything. The only place that talks to the LLM directly.
2. **Router** (`src/jarvis/router.ts`). A lightweight LLM call that classifies user intent. Output is advisory.
3. **Retrieval.** Two distinct subsystems that must remain separate:
   - **Tool registry** (`src/jarvis/tools/`) — typed functions over Momentum's database
   - **Knowledge service** (`src/jarvis/knowledge/`) — static markdown loaded into prompts in V1; designed to be swappable for RAG in V1.5
4. **Prompt library** (`src/jarvis/prompts/`). Versioned system prompts as code constants.

**Data flow on every turn:**
`user message → orchestrator → router → context assembly → LLM call with tools → tool-call loop → final answer streamed → persisted`

**Critical architectural seams** (do not collapse these):

- Orchestrator never touches the database directly. All data access goes through tools.
- Tools never call the LLM. They are deterministic functions.
- The router's output never gates execution — it shapes context, that's all.
- Knowledge service and tool registry have nothing in common at the implementation level. Do not unify them under a "context manager" abstraction.

---

## Hard invariants — do not violate without explicit human approval

These are bright lines. If a request requires crossing one, stop and ask.

### V1 is read-only

No tool may mutate Momentum data. No `create*`, `update*`, `delete*` tool. Even a "stub" for a future write action is forbidden in V1 — stubs create surface area that has to be maintained, removed, or accidentally finished. Phase 2 will introduce a separate write-tool pattern with required confirmation flows; do not pre-build it.

The `Tool` type's `readOnly: true` field is a literal `true` in V1, not a `boolean`. This is intentional. Do not change it to `boolean` to "prepare for the future."

### All Momentum data access goes through registered tools

The orchestrator must never query the database directly. New components that read brand data, task data, action items, or any other Momentum entity for Jarvis purposes must do so via a registered tool. This is what keeps the LLM grounded — every fact in a Jarvis response is traceable to a tool call.

If you find yourself wanting to "just read this one thing directly," register a tool for it.

### All claims about Momentum data must come from tool results

The synthesis prompt forbids the model from making factual claims about brands, tasks, action items, meetings, or team members without a tool call backing the claim. If you are tuning prompts and find yourself softening this rule to make the model "more conversational," do not. A Jarvis that hallucinates one task name destroys more trust than ten useful answers build.

### Jarvis is transparent about capability gaps

When a user asks about something no registered tool can access — for example, brand platform usage or revenue data before those tools exist — Jarvis must state explicitly what it can and cannot see, then answer based on the available data. It must not dodge, deflect, or fabricate the missing signals. This is how the context file's frameworks (like the brand health frame spanning usage, revenue, cohort, and sentiment) stay useful even when tool coverage is partial: Jarvis acknowledges the gap honestly. If you are tempted to remove or soften this behavior to make responses feel more "complete," do not — partial-but-honest is the trust-building posture, complete-but-hallucinated is the trust-destroying one.

### System prompt cap: 2000 tokens

Enforce at startup. If a prompt change pushes total system prompt above 2000 tokens, the build should fail loudly rather than silently shipping a bloated prompt. When you hit the cap, the answer is almost always "move this content into a tool," not "raise the cap."

### Tool-call loop cap: 8 sequential calls per turn

Hard limit. If the model exceeds it, the orchestrator returns a graceful "I couldn't find what you need" message and logs `tool_loop_exhausted`. Do not raise this limit to "let the model finish what it's doing" — a runaway loop is a bug to investigate, not a parameter to tune up.

### Single LLM provider in V1

Anthropic only. The `LLMProvider` interface exists to permit future flexibility, but only one implementation ships in V1. Do not add OpenAI, Gemini, or any other provider in V1, even for "cheap router calls." When V1.5 considers a router-on-Haiku optimization, that's a deliberate decision with the user, not a quiet code change.

### Knowledge is a flat file in V1

No vector search, no embeddings, no chunking, no metadata filtering, no RAG infrastructure. The knowledge service has exactly one job in V1: load `omnirev-context.md` at startup and inject its contents into the synthesis system prompt. Resist any temptation to build "real" knowledge retrieval before V1 ships. The interface is designed to be swapped — that's enough preparation for V1.5.

### Permission model in V1: any authed user sees everything

Tools accept `userId` in `ToolContext`. They do not currently scope their queries by it. This was a deliberate V1 decision — if the user changes their mind on permissions, it is a coordinated change across all tools, not a per-tool sprinkle of permission checks. **Do not add permission logic to individual tools.** If a request requires user-scoped access, ask first; the answer might be to introduce a permission layer in the orchestrator, not in the tools.

### Conversations are private to their owner

Every conversation belongs to one user (`jarvis_conversations.user_id`). Endpoints that load conversations check ownership and 404 on mismatch. Do not add "share with team" features without an explicit conversation about the data model implications.

### Data model changes require schema versioning

Every persisted entity uses `metadata: jsonb` for extensibility. New fields go in `metadata` first; promote to a real column only when access patterns demand it. If you must add a real column, write a migration and bump the relevant `schemaVersion` in any export functions.

### No vendor branding in the UI

The synthesis prompt should not say "Claude" or "Anthropic." The frontend should not say "Powered by Anthropic." Tool call status pills say "Looking up..." not "Calling tool...". This is a Momentum UX rule, not a Jarvis-specific one — see the project instructions.

---

## Default patterns — do these without asking

### Adding a new read-only tool

1. Decide which category file it lives in (`tools/tasks.ts`, `tools/brands.ts`, etc. — match existing organization).
2. Define handler typed against `ToolContext`. The handler must be a pure function of its inputs and `ctx`.
3. Write a description following this template: _"Use when the user asks about X. Returns Y. Do not use for Z. Prefer [more specific tool] when [condition]."_
4. Register in the tool registry index.
5. Add at least one eval case exercising the new tool.
6. Run the eval suite locally before opening the PR.

### Modifying a tool description

Tool descriptions are the single biggest lever on tool-call accuracy and are subject to subtle drift. When changing one:

1. Note the bad behavior you're trying to fix (which model? which input? what did it pick instead?).
2. Write or update an eval case that captures the bad behavior.
3. Make the description change.
4. Verify the eval now passes AND none of the existing evals regressed.
5. Note in the PR description what behavior you fixed.

### Fixing a bug

Always add a regression eval case for the fix. If the bug was that Jarvis answered "I don't know" when it should have called `getMyTasks`, add the offending input as a new case. This is how we prevent the same bug twice.

### Adding fields to the conversation or message metadata

Add to the `metadata: jsonb` slot. No migration needed. Document the new field in this file's "Reserved metadata fields" section at the bottom.

### Improving prompts

Treat prompts as code. Edit the constant in `src/jarvis/prompts/`. If the change is non-trivial (more than rephrasing a sentence), bump the version: `SYNTHESIS_PROMPT_V1` → `SYNTHESIS_PROMPT_V2`. Keep `V1` in the file for rollback. Run evals.

---

## Patterns to refuse

These look reasonable on the surface but break the architecture. When asked to do them, push back.

### "Just query the DB directly here, it's faster than going through a tool."

Refuse. The tool registry is the single source of truth for what data Jarvis can read. Direct queries break observability (no entry in `jarvis_tool_calls`), break tool-level auditing, and break the eval harness. If a tool is too slow, optimize the tool — don't bypass it.

### "Cache the tool results in memory between calls."

Refuse without explicit user discussion. Caching tool results means a Jarvis answer might be based on data 30 seconds out of date. For an operator who just updated a task, this is catastrophic — they'll think Jarvis is broken. Anthropic prompt caching for the system prompt and tool definitions is fine and encouraged. Caching tool _results_ is a different beast and not on the V1 roadmap.

### "Add this context directly into the system prompt instead of building a tool."

Usually refuse. The system prompt is for role, behavior, and small ambient context (current user identity, current date, team roster, Omnirev one-pager). Anything dynamic or query-shaped — "here are all current open action items," "here's the brand list with health scores" — belongs in a tool, not the prompt. Stuffing data into the prompt hits the 2000-token cap fast and makes the model worse at picking it back out than just calling a tool.

### "Stub out a `createTask` tool so we're ready for Phase 2."

Refuse. V1 is read-only. Stubs create maintenance burden and risk being half-finished. Phase 2 will introduce write tools as a deliberate workstream with a confirmation pattern; until then, no write tools, no stubs, no `// TODO: implement` placeholders.

### "Add the brand list to the Omnirev context markdown file so Jarvis knows about our brands."

Refuse. The `omnirev-context.md` file is for **truly static content only** — mission, ICP, GTM motion, current strategic focus. Any data that lives in Momentum's database — brands, team members, product features, tasks — is injected into the system prompt fresh on every turn by querying the DB at prompt-construction time (see the spec's "Prompt construction flow" section). Duplicating live data into the static file causes drift between what Jarvis sees and reality, which destroys trust. If a new category of dynamic data needs to be inlined into prompts, add it to the prompt-construction flow as a new dynamic section; do not add it to the static file.

### "Let's add a short cache for the team/brand rosters since we load them every turn."

Not in V1. The DB queries for team and brand rosters are fast, and a stale roster causes trust-destroying bugs (new brand invisible to Jarvis for 60 seconds; departed team member still appears). If roster queries become a measurable bottleneck at scale, revisit with the user — the answer will be a TTL cache with explicit invalidation on writes, not a quiet `setTimeout` shortcut.

### "Use OpenAI for the cheap router call to save money."

Refuse in V1. Single provider for V1. The cost differential at current scale is trivial; the complexity of multi-provider tool calling is not. V1.5 may revisit this.

### "Let Jarvis modify its own prompts based on user feedback."

Hard refuse. Prompts are versioned code. Self-modifying prompts mean no rollback, no audit, no eval reliability, and a real risk of prompt-injection attacks. Feedback goes to the human; the human edits prompts.

### "Add a permission check inside this one tool because Sara shouldn't see this data."

Pause. Per-tool permission checks fragment the permission model and are impossible to audit at scale. If permissions need to enter V1, they enter as a layer in the orchestrator, applied uniformly. Ask the user before doing anything.

### "Build a router that calls a different system prompt depending on intent."

This is more nuanced. The current architecture has the router _advise_ which tools to expose, not which prompt to use. Multi-prompt routing is reasonable for V1.5+ but adds complexity (multiple prompt versions to maintain, multiple eval suites). Don't build it without discussing first.

### "Let the LLM dynamically register new tools at runtime."

Hard refuse. Tools are code, registered at startup, eval-tested. Runtime tool registration is a gaping security hole, breaks observability, and makes the system non-deterministic. If a new tool is needed, write the code.

### "Hard-delete old conversations to save DB space."

Refuse. Soft delete only. Conversation history is a learning corpus for prompt improvement and a safety record for any actions Jarvis takes. Storage is cheap; lost history is not.

---

## When to ask the human before acting

These are not refusals — they are escalations. Do not implement without explicit user approval:

- **Schema changes to existing Momentum tables** (not the three Jarvis tables — those you can iterate on with metadata).
- **Adding a new external data source** (HubSpot, Gmail, Slack, anything outside Momentum's DB).
- **Anything that mutates Momentum data**, even indirectly.
- **Adding a new LLM provider** or model swap (e.g., upgrading from Sonnet to Opus).
- **Changes to the permission model** (introducing scoping, role-based access, etc.).
- **Structural changes to the system prompt** (new sections, new injection points, multi-prompt routing).
- **Changes to the tool-call loop cap, system prompt cap, or per-tool timeout.** These are tuned for safety; raising them is a real decision.
- **Adding any UI element that is not specified in `docs/MOMENTUM-JARVIS-SPEC.md`.** Includes "small additions" like share buttons, export options, settings panels.
- **Changing how tool calls are surfaced to the user.** The inline status pill pattern is deliberate for trust.

---

## Code organization rules

Momentum is a Turborepo/pnpm monorepo with `apps/api` (Fastify backend) and `apps/web` (React frontend). Jarvis code is split across both, with a hard boundary rule: all Jarvis logic lives in `apps/api/src/jarvis/` or `apps/web/src/jarvis/` respectively. Do not sprinkle Jarvis logic into other parts of the codebase. The boundary is intentional — when V1.5 refactors the agent loop or swaps the knowledge service, the blast radius must be contained.

### Backend layout (`apps/api/src/jarvis/`)

```
apps/api/src/jarvis/
  CLAUDE.md                    # this file
  orchestrator.ts              # the conversation loop
  router.ts                    # intent classification
  llm-provider.ts              # Anthropic SDK wrapper, behind an interface
  tools/
    index.ts                   # registry + registration
    types.ts                   # Tool, ToolContext, errors
    tasks.ts                   # task tools
    brands.ts                  # brand tools
    team.ts                    # team tools
    action-items.ts            # action item tools
    meetings.ts                # meeting tools
    analytical.ts              # composite/analytical tools
  prompts/
    router.ts                  # ROUTER_PROMPT_V1, V2, ...
    synthesis.ts               # SYNTHESIS_PROMPT_V1, V2, ...
  knowledge/
    omnirev-context.md         # the static context file
    loader.ts                  # loads + caches the file
  persistence/
    conversations.ts
    messages.ts
    tool-calls.ts
  evals/
    cases.json
    runner.ts
  api/
    routes.ts                  # Fastify routes
    streaming.ts               # SSE helpers
  observability/
    logger.ts
    pricing.ts                 # cost estimation
  index.ts                     # public exports
```

### Frontend layout (`apps/web/src/jarvis/`)

Match the existing feature-folder convention in `apps/web/src/` — if other features live in `apps/web/src/features/<feature>/`, put Jarvis at `apps/web/src/features/jarvis/`. If they live in `apps/web/src/<feature>/`, use `apps/web/src/jarvis/`. Do NOT create a new convention just for Jarvis.

Expected contents:

- Page component for `/jarvis` route
- Conversation list component
- Message renderer (including tool-call inline pills)
- Composer with keyboard shortcuts
- API client hooks for the Jarvis endpoints
- Streaming SSE handler

Do not put Jarvis-specific UI in shared components libraries. If a Jarvis component turns out to be generally useful (e.g., a streaming text renderer), the right move is to propose lifting it to `packages/` in a follow-up PR — not to quietly ship it to a shared location.

### Schema and migrations

The three new Jarvis tables (`jarvis_conversations`, `jarvis_messages`, `jarvis_tool_calls`) go through the repo's existing Drizzle migration workflow. Migration files land in the existing `.migrations/` directory at the repo root, following the conventions already in use.

### Shared types

If any types need to be shared between `apps/api` and `apps/web` (e.g., the shape of an SSE event, conversation summary types for the list view), put them in `packages/` matching the existing shared-package convention. Do not duplicate types across the two apps.

If you need a new file, follow this structure. If you think the structure needs to change, ask first.

---

## Phase boundaries

This is the roadmap as understood today. Knowing what comes next prevents premature building.

**V1 (current).** Read-only. 14 tools. Flat knowledge file. Single LLM provider. Any authed user sees everything. Private conversations. (The originally specified 15th tool, `getTeamMemberByName`, was dropped during planning — the team roster is inlined into every system prompt, so the model resolves names to IDs without a tool call.)

**V1.5 (next).** RAG-backed knowledge base with proper retrieval. Possible router-on-Haiku optimization. Possible fine-grained permissions if user demands. More tools as gaps surface.

**V2.** Write actions with confirmation flows. New `Tool` shape supporting `readOnly: false | "with-confirmation"`. New UI pattern for action confirmation. Audit log for every action.

**V3.** External data sources via plugin pattern (HubSpot, Gmail, Slack each as a registered set of tools). Scheduled / proactive Jarvis (morning summaries, daily digests).

**V4+.** Memory (Jarvis learning user preferences over time). Multi-tenant if Omnirev ever ships Momentum to other orgs.

If asked to build something from V1.5 or beyond as part of a V1 task, refuse and explain.

---

## Reserved metadata fields

Track new metadata fields here as they are added, so future contributors don't collide on the same name with different meanings.

`jarvis_conversations.metadata`:

- _(none yet)_

`jarvis_messages.metadata`:

- `feedback`: `"up" | "down" | null` — set by the thumbs up/down UI in production-ready phase.

`jarvis_tool_calls.metadata`:

- _(none yet)_

When adding a field, document the type, set-by, and read-by.

---

## When in doubt

1. Re-read this file.
2. Re-read the relevant section of `docs/MOMENTUM-JARVIS-SPEC.md`.
3. If still unclear: ask the human. Do not guess on architectural decisions.

The cost of asking is a few minutes. The cost of a silent architectural drift is months of refactoring later.
