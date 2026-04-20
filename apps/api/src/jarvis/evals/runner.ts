import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, type Database } from '@momentum/db';
import { AnthropicProvider, type LLMProvider } from '../llm-provider.ts';
import { JarvisService } from '../orchestrator.ts';
import { createDefaultRegistry } from '../tools/index.ts';
import { createConversation } from '../persistence/conversations.ts';
import { seedEvalFixtures, EVAL_IDS } from './fixtures.ts';
import type { JarvisLogger } from '../tools/types.ts';

/**
 * Minimal eval harness for V1 Jarvis. Runs every case in `cases.json`
 * against a real LLM + a seeded test DB, asserts tool-call / forbidden-
 * phrase expectations, and fails the process (exit 1) when the pass
 * rate falls below PASS_THRESHOLD (0.9 per spec §10).
 *
 * Everything runs inside one Drizzle transaction that rolls back at the
 * end (via the `RollbackMarker` sentinel throw) — no data persists past
 * an eval run, so the harness is safe to point at any Postgres the dev
 * has handy. CI uses a disposable service container.
 *
 * Intent assertions from `expected_intent` are captured in case files
 * for forward-compat but NOT evaluated in V1 — the router is deferred
 * to V1.5 per the plan-mode edits. See `docs/JARVIS-TODOS.md`.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASES_PATH = path.resolve(__dirname, './cases.json');
const PASS_THRESHOLD = 0.9;
const TURN_TIMEOUT_MS = 60_000;

/* ─────────────── case shape + evaluation (pure — unit-tested) ─────────────── */

export interface EvalCase {
  id: string;
  input: string;
  as_user: keyof typeof EVAL_IDS.users;
  expected_intent?: string;
  expected_tool_calls: string[];
  answer_must_contain?: string[];
  answer_must_not_contain?: string[];
}

export interface EvalTurn {
  assistantText: string;
  toolCalls: ReadonlyArray<{ name: string }>;
}

export interface EvalResult {
  id: string;
  pass: boolean;
  reasons: string[];
  assistantText: string;
  actualToolCalls: string[];
}

/**
 * Pure function: decides whether a case passed. Extracted so unit tests
 * don't have to stand up the orchestrator — the assertion logic is the
 * part most likely to drift.
 */
export function evaluateCase(c: EvalCase, turn: EvalTurn): EvalResult {
  const actualToolCalls = turn.toolCalls.map((tc) => tc.name);
  const actualSet = new Set(actualToolCalls);
  const reasons: string[] = [];

  // Required tool calls (order-independent).
  for (const expected of c.expected_tool_calls) {
    if (!actualSet.has(expected)) {
      reasons.push(`missing expected tool call: ${expected}`);
    }
  }

  // Out-of-scope cases assert zero tool calls — Jarvis should answer
  // from the prompt (or refuse-gracefully per the transparency
  // invariant) without reaching for a tool it doesn't have.
  if (c.expected_tool_calls.length === 0 && actualToolCalls.length > 0) {
    reasons.push(`unexpected tool calls on out-of-scope: ${actualToolCalls.join(', ')}`);
  }

  const textLower = turn.assistantText.toLowerCase();
  for (const phrase of c.answer_must_contain ?? []) {
    if (!textLower.includes(phrase.toLowerCase())) {
      reasons.push(`answer missing required phrase: "${phrase}"`);
    }
  }
  for (const phrase of c.answer_must_not_contain ?? []) {
    if (textLower.includes(phrase.toLowerCase())) {
      reasons.push(`answer contained forbidden phrase: "${phrase}"`);
    }
  }

  return {
    id: c.id,
    pass: reasons.length === 0,
    reasons,
    assistantText: turn.assistantText,
    actualToolCalls,
  };
}

/* ─────────────── case loading ─────────────── */

export function loadCases(casesPath: string = CASES_PATH): EvalCase[] {
  const raw = readFileSync(casesPath, 'utf-8');
  const parsed = JSON.parse(raw) as EvalCase[];
  if (!Array.isArray(parsed)) throw new Error(`cases.json must be an array`);
  return parsed;
}

/* ─────────────── harness ─────────────── */

const silentLogger: JarvisLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

class RollbackMarker extends Error {
  constructor() {
    super('eval-rollback');
    this.name = 'RollbackMarker';
  }
}

export interface RunHarnessOptions {
  db: Database;
  llm: LLMProvider;
  cases: EvalCase[];
  /** Cap each turn — real LLM calls can exceed 30s in practice. */
  turnTimeoutMs?: number;
}

/**
 * Execute every case inside a single transaction, accumulate
 * `EvalResult`s, and roll the transaction back. Returns the results
 * regardless of pass/fail so the caller can report before deciding
 * exit code. Exported separately from `main` so tests can drive the
 * harness with a mock `LLMProvider` if a real-LLM run is too
 * expensive or too flaky for a given gate.
 */
export async function runHarness(opts: RunHarnessOptions): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  try {
    await opts.db.transaction(async (tx) => {
      const ids = await seedEvalFixtures(tx);
      const service = new JarvisService({
        llm: opts.llm,
        registry: createDefaultRegistry(),
        db: tx,
        turnTimeoutMs: opts.turnTimeoutMs ?? TURN_TIMEOUT_MS,
      });

      for (const c of opts.cases) {
        const userId = ids.users[c.as_user];
        const conv = await createConversation(tx, {
          userId,
          title: `eval:${c.id}`,
        });
        try {
          const turn = await service.handleMessage({
            conversationId: conv.id,
            userId,
            userMessage: c.input,
            logger: silentLogger,
          });
          results.push(evaluateCase(c, turn));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            id: c.id,
            pass: false,
            reasons: [`threw: ${message}`],
            assistantText: '',
            actualToolCalls: [],
          });
        }
      }

      throw new RollbackMarker();
    });
  } catch (err) {
    if (!(err instanceof RollbackMarker)) throw err;
  }
  return results;
}

/* ─────────────── entry point (invoked by `pnpm jarvis:eval`) ─────────────── */

function formatResult(r: EvalResult): string {
  const glyph = r.pass ? '✓' : '✗';
  const tools = r.actualToolCalls.length > 0 ? ` [${r.actualToolCalls.join(', ')}]` : '';
  const head = `${glyph} ${r.id}${tools}`;
  if (r.pass) return head;
  return `${head}\n    ${r.reasons.map((rs) => `- ${rs}`).join('\n    ')}`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is required');
    process.exit(2);
  }

  const cases = loadCases();
  console.log(`Loaded ${cases.length} case(s) from ${CASES_PATH}`);

  const { db, client } = createDb({ connectionString: databaseUrl });
  const llm = new AnthropicProvider({ apiKey });

  const startedAt = Date.now();
  const results = await runHarness({ db, llm, cases });

  const passed = results.filter((r) => r.pass).length;
  const passRate = passed / results.length;
  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log();
  for (const r of results) console.log(formatResult(r));
  console.log();
  console.log(
    `${passed}/${results.length} passed · ${(passRate * 100).toFixed(1)}% · ${elapsedS}s`,
  );

  await client.end();

  if (passRate < PASS_THRESHOLD) {
    console.error(
      `\n❌ Pass rate ${(passRate * 100).toFixed(1)}% is below the ${(PASS_THRESHOLD * 100).toFixed(0)}% threshold.`,
    );
    process.exit(1);
  }
  console.log('✓ Eval passed');
}

// Only run when invoked directly (not when imported by tests).
const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
