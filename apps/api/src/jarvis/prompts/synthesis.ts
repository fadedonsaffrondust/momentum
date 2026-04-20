import type Anthropic from '@anthropic-ai/sdk';

/**
 * Synthesis prompt — the main system prompt that frames Jarvis on every
 * turn. Built from two blocks per the spec edit approved in planning:
 *
 *   Block 1 — STATIC (cached):
 *     role + behavior rules + output formatting + tool-use guidance +
 *     Omnirev static context. Changes only on deploy.
 *
 *   Block 2 — DYNAMIC (not cached):
 *     current user identity, current date, team roster, brand portfolio.
 *     Rebuilt every turn.
 *
 * Splitting the blocks means we pay the Anthropic cache-creation cost
 * only when the static half changes (deploys). Rosters can churn daily
 * without busting the cache. See spec §7 Caching.
 */

/** Role / behavior / formatting / tool-use — versioned preamble, unchanged at runtime. */
export const SYNTHESIS_PROMPT_V1_STATIC = [
  "You are Jarvis, the internal AI assistant for Omnirev's leadership team. You answer questions about brands, tasks, action items, meetings, and team workflow by calling tools over Momentum's database.",
  '',
  'Behavior rules:',
  '- Always call a tool before stating a fact about Momentum data. Never fabricate task names, dates, counts, or brand details.',
  "- When a user's question requires signals no registered tool can access (e.g. platform usage or revenue data when those tools don't yet exist), explicitly state what you can and cannot see, then answer confidently based on the available data. Never dodge and never hallucinate the missing pieces.",
  '- If a tool returns nothing, say so clearly.',
  '- Be concise. This is an internal operator tool, not a chatbot.',
  '',
  'Output formatting:',
  '- Compact prose. Use lists only when listing 3 or more items.',
  '- Reference brand and person names in **bold**.',
  '- When mentioning a task or action item, include its ID in parentheses so the user can find it.',
  '',
  'Tool-use guidance:',
  "- Prefer the most specific tool available. Use `getMyTasks` for questions about the asker's own work rather than `getTasks` with a self filter.",
  '- Call tools in parallel when queries are independent.',
  '- Do not paraphrase numbers from tool results without citing the source tool call.',
  '- Resolve brand and person names to IDs from the Team Roster / Brand Portfolio sections below — do not make a tool call just to look up an id you already have.',
].join('\n');

/**
 * Legacy string export preserved so the Task 4 orchestrator test
 * (`expect(firstCall.system).toMatch(/You are Jarvis/)`) continues to
 * typecheck even though the runtime path now uses the array builder.
 * When the orchestrator no longer accepts string-system anywhere, drop.
 */
export const SYNTHESIS_PROMPT_V1 = SYNTHESIS_PROMPT_V1_STATIC;

export interface SynthesisUser {
  id: string;
  displayName: string;
}

export interface SynthesisTeamMember {
  id: string;
  displayName: string;
  email: string;
}

export interface SynthesisBrand {
  id: string;
  name: string;
  status: string;
  goals: string | null;
}

export interface BuildSynthesisInput {
  user: SynthesisUser;
  now: Date;
  teamRoster: SynthesisTeamMember[];
  brandPortfolio: SynthesisBrand[];
  omnirevContext: string;
}

type SystemBlock = Anthropic.Messages.TextBlockParam;

/**
 * Build the two-block system prompt. Block 1 is marked for Anthropic
 * ephemeral cache; block 2 is left uncached so roster changes don't
 * invalidate the cached preamble.
 */
export function buildSynthesisSystemBlocks(input: BuildSynthesisInput): SystemBlock[] {
  const staticText = [
    SYNTHESIS_PROMPT_V1_STATIC,
    '',
    '=== Omnirev context (static) ===',
    input.omnirevContext.trim(),
  ].join('\n');

  const dynamicText = buildDynamicBlock(input);

  return [
    { type: 'text', text: staticText, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamicText },
  ];
}

function buildDynamicBlock(input: BuildSynthesisInput): string {
  const todayIso = input.now.toISOString().slice(0, 10);
  const roster = input.teamRoster.length
    ? input.teamRoster.map((m) => `- ${m.displayName} (${m.id}) — ${m.email}`).join('\n')
    : '- (no active team members)';
  const portfolio = input.brandPortfolio.length
    ? input.brandPortfolio
        .map((b) => {
          const goals = b.goals ? `, goals: ${truncate(b.goals, 80)}` : '';
          return `- ${b.name} (${b.id}) — ${b.status}${goals}`;
        })
        .join('\n')
    : '- (no brands yet)';

  return [
    '=== Identity ===',
    `Current user: ${input.user.displayName || '(unnamed)'} (${input.user.id})`,
    `Current date: ${todayIso}`,
    '',
    '=== Team Roster ===',
    roster,
    '',
    '=== Brand Portfolio ===',
    portfolio,
  ].join('\n');
}

function truncate(s: string, max: number): string {
  const trimmed = s.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + '…';
}

/**
 * Rough token budget check for the system prompt. Spec §5 caps the full
 * system prompt (static + roster injections + Omnirev context) at 2000
 * tokens; this assertion validates the STATIC half at startup — the
 * dynamic half scales with roster size and is a deploy-time-only budget
 * concern (spec §5 allocates ~200 tokens for ~10 team members, ~300 for
 * ~20 brands).
 *
 * Tool definitions are NOT in this budget — they're counted against
 * Anthropic's `tools` param, which has a separate much larger budget.
 *
 * A ~4-chars-per-token heuristic is intentionally generous; real
 * Anthropic tokens compress structural punctuation. This is a regression
 * guard, not a billing estimator.
 */
export const SYSTEM_PROMPT_TOKEN_CAP = 2000;

export function assertStaticPromptUnderCap(
  staticText: string,
  cap: number = SYSTEM_PROMPT_TOKEN_CAP,
): void {
  const estimatedTokens = Math.ceil(staticText.length / 4);
  if (estimatedTokens > cap) {
    throw new Error(
      `Jarvis static system prompt estimated at ${estimatedTokens} tokens, above the ${cap}-token cap. Move content into a tool instead of raising the cap. See guardrails "System prompt cap: 2000 tokens".`,
    );
  }
}
