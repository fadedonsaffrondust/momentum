# Jarvis — Founder's Playbook (Demo → Production)

**For:** Nader
**Paired with:** `MOMENTUM-JARVIS-SPEC.md`
**Purpose:** Everything Claude Code won't do for you. Your active role before, during, and after the build.

---

## How to use this doc

The spec tells Claude Code how to build Jarvis. This doc tells you what _you_ need to do around it — the decisions, prep work, content writing, testing, and rollout that can't be delegated. It's structured in three phases: pre-build, demo-ready, production-ready. Treat each phase as gates rather than deadlines.

---

## Phase 0 — Before Claude Code starts

Do all of this in one sitting. It's maybe a 45-minute block. Skipping it means Claude Code will get stuck on the first day asking questions you could have answered up front.

### Decisions to lock

Two decisions from the spec's "open architectural decisions" section need final answers before the build starts. Both were defaulted to the simpler option; changing your mind later costs time.

**Permission model.** The spec assumes any logged-in Momentum user can ask Jarvis anything and see all data. If you want restrictions — for example, certain team members shouldn't see brand financials, or a junior ops person shouldn't see strategic action items — say so now. The honest recommendation: for an internal tool among a leadership team, no permissions is almost always the right call. It's a shared operating picture. But you know your team.

**Conversation privacy.** The spec assumes each person's Jarvis conversations are private. If you want the leadership team to be able to read each other's chats — a "how did Nader think about that brand last week" kind of affordance — that changes the data model and UI. Recommendation: keep private for V1, add "share" as a V2 feature if there's demand.

### Infrastructure prep

- **Anthropic API key.** Provisioned, set up with a reasonable rate limit and a monthly spending cap. For a single-user V1, $50/month is a generous cap; $200/month for the whole leadership team actively using Jarvis should be more than enough. Set the cap lower than you expect — hitting the cap is annoying; hitting a surprise $4k bill is career-denting.
- **Environment variables.** Add `ANTHROPIC_API_KEY` to your existing secrets management (whatever Momentum uses — Doppler, 1Password, AWS Secrets Manager, .env.local). Claude Code will reference this from the codebase; make sure the dev, staging, and prod environments all have it.
- **Database migrations.** Confirm your migration tooling (Drizzle migrate, probably) is clean and ready. Jarvis adds three tables; if you have pending migrations or drift, sort that first.
- **Feature flag.** Whatever flag system Momentum uses, create a `jarvis_enabled` flag gated to your user ID only. Claude Code will wire the navbar entry behind this flag. You can open it to the team gradually.

### Content prep — the Omnirev context file

This is the one piece of content you can't delegate. It's a single markdown file that will be loaded into every Jarvis prompt, so it needs to be compact and high-signal. Aim for 300-400 words total — short, dense, no fluff.

**Important:** This file is for truly static content only. Brand portfolio, team roster, and any other data that lives in Momentum's database will be pulled live from the DB on every Jarvis turn — do _not_ duplicate that data into this file or it will drift and Jarvis will start contradicting itself.

Draft it now. Rough structure:

- **What Omnirev does.** Two sentences. The catering-for-enterprise-restaurants positioning.
- **ICP.** One paragraph. Catering managers and VP-ops at 50-1000 location chains.
- **Go-to-market motion.** One paragraph. Email-first, activation of existing contacts, journey mapping.
- **Current strategic focus.** One paragraph on what's priority this quarter. Update this quarterly — set yourself a recurring calendar reminder to revisit.
- **Anything else genuinely static and useful** that isn't represented as DB data — for example, the principles you operate by, how you think about brand health categorically (not specific brand health values), or how you frame the relationship between catering and core dining revenue.

Don't over-polish. Jarvis reads this, not a board member. The point is to give the model enough context that it doesn't hallucinate about your business.

What used to be in earlier drafts of this file but should NOT be here: the brand list, team member list, product features. All of that is now injected into Jarvis's prompt automatically from Momentum's database on every turn — that's why it stays accurate as you add brands, hire people, or ship features.

Save this to `src/jarvis/knowledge/omnirev-context.md` when you hand off to Claude Code.

### Fixture data for evals

Claude Code will build an eval harness with 20 starter cases. Those cases need deterministic test data to run against. If Momentum has seeded dev data, you can usually reuse it. If not, spend 20 minutes defining a small test fixture: 3 brands, 4 team members, ~15 tasks, ~10 action items, 2 meetings. Enough to test all 15 tools.

---

## Phase 1 — Active role during the build

Claude Code will move fast. Your job during the build isn't to code; it's to compress the feedback loop. Three things matter more than anything else.

### Use Jarvis as it's being built

The moment Claude Code ships the first working tool-call loop (step 6 in the spec's build sequence — you'll have a working, ugly Jarvis), start using it. Not testing it — _using it_. Ask real questions about your real work.

You will find things nobody else will:

- Tools that return technically correct but unhelpful data
- System prompt language that makes Jarvis sound like a robot
- Tool descriptions where the model guesses wrong between two similar tools
- Latency spikes that are fine in isolation but feel slow three times in a row

Log every issue in a single note as you go. Don't fix in-the-moment — batch and hand to Claude Code at the end of each day. Most AI features die in this iteration loop; the ones that feel magical survive it.

### Iterate the tool descriptions

Tool descriptions are the single biggest lever on tool-call accuracy. Claude Code will ship first drafts based on the spec. They won't be right. You'll see Jarvis picking `getTasks` when it should pick `getMyTasks`, or calling `getBrand` with no ID when the user said "how's Boudin" instead of chaining through a lookup.

This is normal. The fix is always in the description, almost never in the code. Spend a day iterating descriptions based on real observed failures. This is high-leverage work only you can do — it requires knowing what _should_ have happened.

### Expand the eval set as you go

The 20 starter cases are a floor, not a ceiling. Every time you catch Jarvis doing something wrong, add a test case. By launch you want 50+ cases; by month three, 150+. This is how you prevent regressions when you iterate prompts or swap models.

---

## Phase 2 — Demo-ready

"Demo-ready" means you could show Jarvis to a potential investor, a new hire, or your team at Friday all-hands without apologizing. The bar is _low failure surface_, not _comprehensive capability_.

### Checklist

- All 15 V1 tools working end-to-end
- 20+ eval cases passing at ≥90%
- First-token latency under 1.5 seconds on your home internet
- No visible UI jank: streaming is smooth, tool-call pills animate cleanly
- Keyboard shortcuts work on the Jarvis page
- Empty state, loading state, error state all designed and shipped
- You've used Jarvis for actual daily planning for at least 3 consecutive days without a serious issue
- You have 5-7 canned demo queries that reliably produce impressive responses

### Demo script

Pick a few narrative arcs before you demo. Don't freestyle — a demo that goes "let me show you" and then Jarvis picks the wrong tool is worse than no demo. Good candidates:

1. **Morning routine.** "What's on my plate today?" → "Which brand needs the most attention?" → "What's the status of Boudin?" — tells a story of Jarvis as daily operator's tool.
2. **Team visibility.** "What's Sara working on?" → "Are any of her action items overdue?" — shows cross-team intelligence without needing Slack or a PM tool.
3. **Brand deep-dive.** "How is Cowboy Chicken doing?" → "What were the key points from our last meeting with them?" — shows brand-level intelligence.

Test each arc ten times before demo day. If it fails even once, fix it before demoing.

### What demo-ready is NOT

Demo-ready is not production-ready. Don't open Jarvis to the team at this point. The difference between "works for Nader in controlled demos" and "survives a VP ops poking at it for an hour" is another full phase of work.

---

## Phase 3 — Production-ready

Production-ready for Momentum means "every member of the Omnirev leadership team can use Jarvis in their daily work without me being in the loop." The bar is trust and durability, not polish.

### Trust and quality

- **Eval set at 50+ cases**, pass rate ≥95%.
- **Hallucination audit.** Pick 30 real Jarvis responses from your last week of use. For each, verify every factual claim against the underlying data. If you find _any_ hallucinated fact — a task that doesn't exist, an action item misattributed — treat it as a blocking bug. This is the single most important trust test.
- **Tool description audit.** Review every tool description against recent misclassifications. Tighten anything that's ambiguous.
- **System prompt review.** Re-read it with fresh eyes. Cut anything that's not earning its tokens.

### Durability

- **Retry logic.** What happens when Anthropic's API has a transient 529? Jarvis should gracefully retry once, then fail cleanly. Test this by pointing at a mock endpoint that returns errors.
- **Timeout behavior.** What happens when a tool hangs? Confirm the 5s tool timeout and 30s turn timeout are enforced and produce readable errors.
- **Rate limits.** What happens when a user fires 10 messages in 30 seconds? Add a simple per-user rate limit (e.g., 1 concurrent Jarvis call per user, queue or reject the rest).
- **Cost controls.** Anthropic spending cap is set. Internal monitoring alert fires at 70% of cap. You review cost per user weekly.

### Observability and feedback

- **Dashboard.** A simple internal page (can be a read-only query against `jarvis_messages` and `jarvis_tool_calls`) showing: messages per day, avg latency, error rate, tool usage distribution, cost per day, cost per user. Doesn't need to be pretty.
- **Thumbs up/down on every assistant message.** Two buttons, store to `jarvis_messages.metadata.feedback`. Review weekly. Thumbs down is your signal for what to improve next.
- **Weekly review ritual.** Fifteen minutes every Friday: skim the thumbs-down list, check the top-5 slowest turns, look at tool-call failure rate. Pick one thing to improve next week. This is how Jarvis actually gets better over time.

### Rollout

Don't flip the flag for the whole team on day one. Roll out in stages:

1. **Week 1:** You only. Use it daily. Collect issues.
2. **Week 2:** Add 1-2 close team members. Watch their usage. Ask them what was surprising or frustrating.
3. **Week 3:** Full leadership team. Send a brief launch note with 5-6 example prompts to seed good behavior.
4. **Month 2:** Consider broader Omnirev team if the leadership usage is healthy.

### Monitor these risk signals after launch

- **Latency creep.** If P50 turn latency climbs past 4 seconds, something's wrong — probably a tool doing too much work or an unbounded loop.
- **Cost per user rising fast.** Typical healthy usage settles at <$1/user/day. If someone's burning $5+, investigate — they're either in a tool-call loop or sending massive context.
- **Declining usage.** If daily active users drops after week 3, something about Jarvis doesn't stick. Ask them why. The reason will tell you the V1.5 priority.

---

## Decisions you'll face during the build

These are the judgment calls Claude Code will hit and look to you for. Pre-deciding them saves time.

### "Should Jarvis apologize when it doesn't know?"

Yes, but briefly. "I don't have data on that" is better than "I'm sorry, I apologize, unfortunately I wasn't able to find information..." Tighten this in the synthesis prompt if you see verbose hedging.

### "Should Jarvis use emojis?"

No. Keep it professional. Omnirev's leadership is a serious crowd.

### "How formal should Jarvis sound?"

Operator-friendly but not bro-ey. "Boudin has 4 open action items" not "Boudin's got some stuff on their plate!" Think Linear, not Slackbot.

### "Should Jarvis suggest follow-up questions?"

Not in V1. The user knows what they want. Suggesting follow-ups is a nice-to-have that adds surface area without clear value yet. Revisit in V1.5.

### "Should there be a 'clear conversation' button?"

New conversation (`Cmd+N`) is enough. Don't build a clear button that people will accidentally hit.

### "Should we show token counts or costs to the user?"

No. That's an internal observability concern. The user sees performance (it's fast) or doesn't (it's slow); they shouldn't be counting tokens.

---

## What happens next

Once V1 is shipped and the leadership team is using it reliably, the V1.5 and V2 roadmap starts to write itself based on real behavior. The most likely candidates — in rough order of value:

- **Brand health tool coverage.** The brand health framework in your Omnirev context file spans four layers: platform usage, catering revenue, customer cohort health, and sentiment. V1 only covers the sentiment layer (via meetings, action items, feature requests). To let Jarvis fully answer "how is Boudin doing" and "which brand needs the most attention," V1.5 should add tools for (1) platform usage — weekly automation counts and sequence counts per brand, (2) catering revenue — MoM and YoY, (3) customer cohort data — returning and new customer cohort growth. This is the single highest-leverage V1.5 investment because it upgrades brand health from "partial signal" to "full picture."
- **RAG-backed knowledge base.** Once the flat context file is creaking under its own weight (you'll know when you're tempted to add 2000 more words to it), stand up proper document retrieval.
- **Write actions.** Create task, update action item status, mark meeting reviewed. Each requires a confirmation UI pattern. Worth doing right, not fast.
- **Proactive Jarvis.** Morning summary email, end-of-day review prompt, weekly brand health digest. These are workflows, not features.
- **External data sources.** HubSpot, Gmail, Slack integrations — each as a new set of registered tools.
- **Memory.** Jarvis learning your preferences, your priorities, your patterns. High value, but only meaningful once the base system has six months of conversation data.

Resist the urge to pre-plan all of this. Ship V1, use it, let the next priority emerge from actual use. The biggest mistake at this stage is building V2 features before V1 has earned trust.
