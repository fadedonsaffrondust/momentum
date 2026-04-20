# Jarvis — Running Backlog

Living capture doc for anything that comes up during planning and building but isn't
in the current build scope. Be aggressive about capturing. If you think "good idea but
out of scope" or "we'll fix that later" — it goes here.

Entry format:

- [ ] **<short title>** — <one-to-three-sentence description, including why it's
      deferred and what would trigger picking it up>

---

## Deferred from spec

These are explicit V1 non-goals. They are not bugs; they are conscious punts.

- [ ] **Write tools (Phase 2)** — No `createTask`, `updateActionItem`, or any data
      mutation. Unblock once Phase 2 starts and we have a confirmation-flow pattern and
      an audit log design.
- [ ] **RAG / vector search knowledge base (V1.5)** — V1 is a flat markdown file.
      Trigger: Omnirev context grows past ~500 tokens of genuinely static content, or
      we want to embed historical meeting notes / past customer conversations.
- [ ] **Fine-grained permissions (V1.5 if needed)** — V1 model is "any authed user
      sees everything." Trigger: a concrete scenario where one user should not see
      another's data. Implementation lives in the orchestrator, not individual tools
      (per guardrails).
- [ ] **Scheduled / proactive Jarvis (V3)** — No morning summaries, no daily digest
      emails. Separate feature when it arrives.
- [ ] **Multi-modal input (V2+)** — No file uploads, no images in V1.
- [ ] **Sharing conversations (V2 maybe)** — Strictly private per user in V1. The
      trust argument for private-by-default is in the spec §13.2.
- [ ] **Hard delete of conversations (V1.5)** — Soft archive only. Storage is cheap;
      history is a learning corpus.
- [ ] **Custom tool selection by user (never?)** — The model picks tools. Users
      don't. If this ever comes up as a request, push back hard.
- [ ] **Multiple LLM providers (V1.5 maybe, V2 likely)** — Anthropic only in V1.
      The `LLMProvider` interface exists for future flexibility.
- [ ] **Voice input/output (V2+)** — Not now.
- [ ] **Mobile-optimized layout (V1.5+)** — Desktop only for V1.

## Shipped in Task 1 — spec edits applied to `docs/MOMENTUM-JARVIS-SPEC.md`

All six edits proposed during the plan-mode session were approved and applied to the
spec in the same commit that installed the guardrails. Kept here for traceability.

- [x] **Drop `userRole` from `ToolContext` in V1** — JWT has no role claim;
      permissions aren't scoped in V1. Add back when the permission layer is
      introduced. _(§4 Registry contract.)_
- [x] **Defer the intent router to V1.5** — Router output is advisory-only in V1;
      removing it saves ~500ms per turn. `jarvis_messages.intent` column stays
      nullable for forward compatibility. _(§2, §5, §7, §11, §12.)_
- [x] **Split system-prompt caching into static + dynamic blocks** — Static
      preamble (+ Omnirev context + tool defs) is cached; team/brand rosters are
      rebuilt fresh. _(§7 Caching.)_
- [x] **Drop `getTeamMemberByName` from V1 tools** — Roster is already inlined in
      the system prompt. Re-introduce if the team grows past the size we can inline.
      _(§4 V1 tool list; §11 build sequence.)_
- [x] **Replace spec §8 keyboard shortcuts with Momentum-aligned bindings** — `n`,
      `/`, `?`, `Enter`/`Shift+Enter`/`Cmd+Enter`, `Esc` (two-stage), `j/k`, plus
      `g j` chord. No `Cmd+N`, `Cmd+K`, or `Cmd+/` bindings. _(§8.)_
- [x] **First-60-chars for conversation title in V1** — No LLM title-gen.
      Trigger: if users consistently rename conversations immediately, revisit.
      _(§6 `POST /conversations`.)_
- [x] **Skip intent assertions in the V1 eval harness** — Housekeeping edit that
      falls out of deferring the router: `expected_intent` stays in the case format
      for V1.5. _(§10.)_

## Ideas surfaced during planning

- [ ] **Tool-call pills link into Momentum entities** — A pill for a brand lookup
      could link to that brand's Momentum detail page; an action-item pill could open
      the task drawer. Nice trust affordance but not V1.
- [ ] **TTL cache on team/brand roster queries** — 60s TTL with explicit
      invalidation on roster writes. Only if measurement shows the per-turn roster
      queries are a real latency tax. Guardrails explicitly forbid adding this without
      an explicit user conversation.
- [ ] **Offline intent classification over logs** — If we want the `intent`
      telemetry without the router call, we can back-fill the column by classifying
      stored user messages in a periodic job.
- [ ] **Thumbs up/down feedback UI** — `jarvis_messages.metadata.feedback` is
      already reserved as `"up" | "down" | null`. V1.5 UI could light this up.
- [ ] **Conversation list search** — The spec mentions a search input but doesn't
      spec the behavior. Deferred to V1.5 unless we find list-scroll painful in V1.
- [ ] **Conversation rename UI** — Spec mentions user rename in one sentence with
      no shortcut or UI location. Capture as V1.1 polish.
- [ ] **Admin dashboard for cost + tool success rates** — The structured log lines
      are already self-describing. A small dashboard would make weekly review trivial.
      V1.5.
- [ ] **LLM-summarized titles** — If first-60-chars feels ugly, backfill via an
      async title-gen call after the first assistant turn completes.
- [ ] **Eval case authoring UI** — Adding eval cases as JSON is fine for 20 but
      gets annoying at 100+. Nice to have.
- [ ] **Inline retry with modified message** — When a turn errors, current plan
      is "Retry" = re-send unchanged. Could surface an edit-and-retry affordance.

## Tech debt / cleanup

_(Empty — populate during the build whenever a shortcut is taken intentionally.)_

## Open questions

- [ ] **Eval CI environment** — GitHub Actions runs against what DB? A Postgres
      service container seeded from `fixtures.ts`, or a persistent staging DB? Decide
      at start of Task 12. (Lean toward service container for hermeticity.)
- [ ] **Jarvis sidebar icon** — Lucide's `Sparkles` is already used in the
      Sidebar file. Use it for Jarvis, or pick something more distinctive (`Bot`,
      `MessageSquare`)? Decide in Task 7.
- [ ] **Anthropic SDK version** — Which exact SDK version to pin? Sonnet 4.6 tool
      use and prompt caching are stable; pick the latest stable at Task 4 start and
      note in the PR.
- [ ] **`stop_reason` handling beyond `end_turn`** — What do we surface to the
      user if the model returns `max_tokens`? Treat it as an error, or stream as
      partial? Decide in Task 4 based on actual Anthropic SDK behavior.
- [ ] **Rate-limit policy for `/api/jarvis/conversations/:id/messages`** — The
      endpoint hits the Anthropic API; a runaway client could burn quota. Does
      Momentum already have rate-limiting middleware, or does Jarvis need its own
      per-user throttle? Check in Task 6.
