# Momentum — Backlog & Ideas

A running list of features, polish items, and technical debt identified while building Momentum. Ordered roughly by value, not urgency.

---

## Automatic daily ritual triggers

The product spec calls for Plan My Day and End of Day Review to open automatically at the right time of day. Currently both only open via keyboard shortcut or command palette.

- [ ] **Auto-open Plan My Day** on the first visit each day before noon. Track `lastPlanDate` in `user_settings` (or localStorage) and trigger `openModal('plan-my-day')` if it's not today and `new Date().getHours() < 12`.
- [ ] **Prompt End of Day Review** after 5pm. Show a dismissible toast/banner (not a forced modal) with an "Open review" action.
- [ ] **Skip auto-prompts on weekends** (user-configurable).

Rough scope: ~30 lines in `apps/web/src/layout/AppShell.tsx` plus a small settings addition.

---

## Voice-controlled version

A hands-free mode for capturing and navigating tasks by voice. Think "Alexa for your day."

- [ ] **Voice capture for new tasks.** Use the Web Speech API (`SpeechRecognition`) to transcribe spoken input, then run it through the same `parseQuickAdd` parser so "Buy domain 30 minutes product high priority tomorrow" resolves to a task with time, role, priority, and schedule set.
  - Add a mic button to the input bar.
  - Push-to-talk (hold `V`) or voice activation wake-word.
- [ ] **Voice commands for actions.** Map phrases to existing task actions: "start", "complete", "defer", "change role to product", "next task", "go to backlog".
  - Requires an intent parser — start with a simple keyword matcher, upgrade to LLM classification later.
- [ ] **Spoken feedback.** Use `SpeechSynthesis` to confirm actions ("Started: Buy domain") and read back the next task. Optional, can be muted.
- [ ] **LLM fallback for ambiguous phrases.** When the keyword matcher can't classify an utterance, pass it to a small LLM (Claude Haiku) with a tool-use schema that mirrors the existing REST endpoints.
- [ ] **Privacy mode.** All speech recognition runs in-browser by default. An opt-in flag sends audio to a server-side Whisper/Deepgram for higher accuracy.

Rough scope: ship V1 as browser-only Web Speech API with keyword matching, ~2 days of work.

---

## Data model & UX gaps

Things that are missing or awkward in the current UI.

- [ ] **Click the role badge on a task card to change it.** Complements the `r` keyboard shortcut with a discoverable mouse path for new users.
- [ ] **Edit all task fields inline**, not just the title. Pressing `e` should expose estimate / priority / scheduled date in the same inline form, not just title.
- [ ] **Drag-and-drop between lanes** on the Today view for mouse users. Keyboard-first is non-negotiable, but drag is the expected fallback.
- [ ] **Task search.** `Cmd+F` or a search field in the command palette to jump to a task by title across Today + Backlog + Done.
- [ ] **Recurring tasks.** "Write standup update every weekday" — a first-class concept, not a copy-paste workaround.
- [ ] **Task notes / subtasks.** A short markdown body attached to a task for context, links, or a checklist.
- [ ] **Quick reorder within a column.** `Shift+j / Shift+k` to move the selected task up or down in Up Next.

---

## Timezone & time-of-day handling

Right now everything uses browser-local time via `new Date()`. That's fine for a single-device solo user but breaks in edge cases.

- [ ] **Store a preferred timezone in `user_settings`** and compute "today" on the server for API queries so travel / DST / second-device quirks stop happening silently.
- [ ] **DST-safe duration math** on the `started_at → completed_at` → `actual_minutes` path (currently millisecond subtraction, which is mostly fine but not rigorous).
- [ ] **"Working hours" awareness.** User sets start/end of workday; the time budget bar reflects remaining hours, not capacity from midnight.

---

## Light mode: proper refactor

Light mode currently works via a block of `!important` overrides in `apps/web/src/index.css` that remap hardcoded zinc classes. It's a hack.

- [ ] **Convert surface colors to CSS variables** (`--m-bg`, `--m-surface`, `--m-fg`, `--m-border`, etc.).
- [ ] **Update every component** to use `bg-[var(--m-surface)]` / Tailwind arbitrary values or semantic utility classes.
- [ ] **Delete the `!important` block** from `index.css` once the refactor is complete.

---

## Offline support

Momentum is supposed to feel instant. Today it's live API on every action.

- [ ] **Optimistic updates** in TanStack Query for create / update / delete / start / complete / defer — instant UI, reconcile with server response.
- [ ] **Offline queue.** If the API is unreachable, queue writes in IndexedDB (`idb-keyval`) and replay on reconnect. Show a discreet "offline" pill in the header.
- [ ] **Service worker + PWA manifest** so the app loads without network and can be installed.

---

## Stats & introspection

Weekly Stats is intentionally minimal. Obvious next steps:

- [ ] **30-day view** with month-over-month comparison.
- [ ] **Per-role breakdown** — which hat takes the most time, which has the best completion rate.
- [ ] **Estimation accuracy histogram** instead of a single ratio.
- [ ] **"Time to ship" distribution** — how long tasks sit in Up Next before being started.

---

## Platform & infrastructure

- [ ] **Deployment recipe.** Dockerfile for the API, Vercel/Netlify config for the web. Neon or Supabase for Postgres. CI/CD pipeline.
- [ ] **Seed script** that creates a demo user with realistic tasks so new contributors can explore without typing 20 things.
- [ ] **API rate limiting + request logging** for production readiness.
- [ ] **Password reset flow** (currently no way to recover a lost password).
- [ ] **Multi-device auth** — refresh tokens instead of 7-day JWTs.
- [ ] **E2E tests** with Playwright covering the golden path (register → first-run → create task → start → complete → review).

---

## Accessibility

- [ ] **Visible focus rings** on every interactive element (currently inconsistent).
- [ ] **`aria-live` region** for toasts so screen readers announce undo/error messages.
- [ ] **High-contrast mode** that stays readable without the zinc blur effects.
- [ ] **Reduce-motion media query** that disables the scale/slide modal animations.

---

## Known rough edges

Small things worth fixing before polish-oriented work:

- [ ] **`useTasks({})`** in PlanMyDay fetches every task; should use a paginated or date-range endpoint once volume grows.
- [ ] **Delete undo** re-creates the task with a new UUID instead of restoring the original. Harmless today, breaks any future "task activity history" feature.
- [ ] **Max-2 in-progress enforcement** returns a 400 but the UI just shows a toast. Spec says it should prompt: "You already have 2 tasks in progress. Pause which one?" with a picker.
- [ ] **Import currently inserts roles with fresh IDs**, so imported data no longer references the original role UUIDs in any external system. OK for solo backup/restore, problematic for future sharing.

---

## Parkings — deferred

Features intentionally cut from the V1 Parkings scope (see release notes v0.2.0). Re-prioritize once the basic flow has real usage.

- [ ] **Threaded comments on parking items.** Upgrade the freeform `notes` field to a real comments model with timestamps and (eventually) multi-user attribution.
- [ ] **Auto-generate a daily standup summary** from discussed parkings — a one-click "what got decided" digest.
- [ ] **Shared parkings across users.** Currently single-user scoped; multi-user sharing would require an ACL model on top of parkings.
- [ ] **Notifications / email alerts** when a daily approaches and you have open parkings.
- [ ] **Smart `target_date` resolution** that respects working days and holidays, so "+next daily" skips weekends and configured non-work days.
- [ ] **Rich-text / markdown preview** for notes and outcome fields.

---

## Release notes — deferred

- [ ] **i18n / translations** for release notes content.
- [ ] **Diff links** from each release note item to the underlying git commit or PR.
- [ ] **Persistent "unseen" badge** on the sidebar "What's new" link that survives across browsers (store in `user_settings` rather than localStorage).

---

## Keyboard shortcuts — deferred

Items intentionally cut from the global-shortcuts refactor (see release notes v0.2.5). Revisit when we have more keyboard-navigation surface area or when modal shortcuts grow beyond their current handful.

- [ ] **Unify modal-internal shortcuts** (`RolePickerModal`, `ReleaseNotesModal`, `CommandPaletteModal`) under the same global shortcut infrastructure. They each register their own `keydown` listener today — correct and scoped, but non-uniform.
- [ ] **Keyboard selection + actions on the Backlog view.** Today the backlog is a read-only list with a mouse-only "→ Today" button per row. Add `j/k` selection, `t` (move to today), `e` (edit), `Delete` (remove) so the backlog feels like Today and Parkings.
- [ ] **Configurable `g` prefix timeout.** Hard-coded to 1500ms. Some users may want it shorter or longer; could be a user setting once preferences grow.
- [ ] **Consider migrating shortcut registration to `react-hotkeys-hook`.** The hand-rolled hook is working, but a library would give us sequence-key parsing (`gt`, `gg`), scoping, and help-text generation for free. Not urgent — revisit only if the hand-rolled hook starts accumulating bugs.

---

## Brands — deferred (V2)

Features intentionally deferred from the V1 Brands implementation (see release notes v0.3.0). The `customFields` JSONB column is ready for extensibility.

- [ ] **Brand-level metrics** — revenue, deal stage, contract dates, renewal timeline. Store in `customFields` JSONB.
- [ ] **Stakeholder sentiment tracking** — per-stakeholder health/mood signal updated after each meeting.
- [ ] **Email integration / thread capture** — ingest email threads and link them to brands/stakeholders.
- [ ] **Meeting transcription from audio** — upload audio files, transcribe via Whisper/Deepgram, extract action items.
- [ ] **LLM-generated brand summary** across all meetings — "What's happened with Boudin this quarter?"
- [ ] **Search across all brands/meetings** — full-text search over meeting notes, action items, stakeholder names.
- [ ] **Multi-user collaboration / sharing** — shared brands with per-user access control.
- [ ] **`.docx` import support** — V1 is `.md`/`.txt` only. Add `.docx` parsing via a library like `mammoth`.
- [ ] **"Enhance with AI" on individual meetings** — re-run LLM extraction on a single meeting's notes to generate summary + action items, not just on import.
- [ ] **Brand-level keyboard nav on the list** — `j/k` to navigate brands, `Enter` to open, without needing the mouse.
- [ ] **Task card brand badge** — when a task is linked to a brand action item via "Send to Today", show a small brand name badge on the task card in the Today view.
