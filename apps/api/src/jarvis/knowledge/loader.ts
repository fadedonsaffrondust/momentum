import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads `knowledge/omnirev-context.md` (installed in Task 1) and caches
 * it in memory. The file holds truly static content only — mission, ICP,
 * GTM motion, strategic focus — per the guardrail "Do not duplicate live
 * DB data into the static file." Dynamic rosters (team members, brand
 * portfolio) are built fresh per turn in the orchestrator.
 *
 * V1 caches on first load; bumps require a server restart. Hot-reload
 * is deferred — captured in docs/JARVIS-TODOS.md.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.resolve(__dirname, './omnirev-context.md');

let cache: { path: string; content: string } | null = null;

export function loadOmnirevContext(customPath?: string): string {
  const target = customPath ?? DEFAULT_PATH;
  if (cache && cache.path === target) return cache.content;
  const content = fs.readFileSync(target, 'utf-8');
  cache = { path: target, content };
  return content;
}

/** Escape hatch for tests. Drops the in-memory cache so the next call re-reads. */
export function _clearOmnirevContextCache(): void {
  cache = null;
}
