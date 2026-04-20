import type { z } from 'zod';
import type { Database } from '@momentum/db';

/**
 * Minimal logger interface the tool layer depends on. Fastify's pino-based
 * logger (`app.log`, `req.log`) satisfies this structurally; tests can
 * stub it trivially. Keeping Jarvis tools decoupled from `fastify` types
 * means the registry can be reused from non-HTTP entry points (future
 * CLI, scheduled jobs, evals) without dragging the web framework in.
 */
export interface JarvisLogger {
  info: (obj: object | string, msg?: string) => void;
  warn: (obj: object | string, msg?: string) => void;
  error: (obj: object | string, msg?: string) => void;
  debug: (obj: object | string, msg?: string) => void;
}

/**
 * Context threaded into every tool handler. `now` is injected (not
 * `new Date()` inside the handler) so tools are deterministic under
 * `vi.useFakeTimers()` and so evals can freeze time.
 *
 * `userRole` is intentionally absent in V1 — Momentum's JWT doesn't carry
 * a role claim and V1's permission model is "any authenticated user sees
 * everything." When permissions arrive in V1.5+, the check lands as a
 * layer in the orchestrator (applied uniformly), not as per-tool plumbing.
 * See `apps/api/src/jarvis/CLAUDE.md` for the invariant.
 */
export interface ToolContext {
  userId: string;
  now: Date;
  db: Database;
  logger: JarvisLogger;
}

/**
 * The shape every V1 tool satisfies. `readOnly: true` is a literal — V1
 * is read-only and the literal type is the compiler gate that prevents
 * accidental write tools. Phase 2 widens this to
 * `true | false | 'with-confirmation'` as a deliberate type change.
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  // Schemas with .default() / .transform() have differing input and output
  // types (e.g. `limit?: number` in, `limit: number` out). Typing the
  // Input slot as `unknown` lets `z.object({ ... .default(...) })` slot in
  // without complaint while the `TInput` slot still reflects the handler's
  // post-parse shape.
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  readOnly: true;
  handler: (args: TInput, ctx: ToolContext) => Promise<TOutput>;
}

/**
 * Registry storage shape. Widened from `Tool<unknown, unknown>` because the
 * handler parameter is contravariant — `Tool<{brandId: string}, ...>` is
 * NOT assignable to `Tool<unknown, ...>` in TypeScript. The runtime cost is
 * zero; the typing cost is that callers pulling tools out of the registry
 * receive `Tool<any, any>` and are expected to narrow via the inputSchema.
 * The registry itself narrows automatically: it parses with the tool's own
 * schema before invoking the handler.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any, any>;

/** Hard ceiling on tool execution. Enforced in `ToolRegistry.executeTool`. */
export const TOOL_TIMEOUT_MS = 5_000;

export class ToolNotFoundError extends Error {
  readonly toolName: string;
  constructor(toolName: string) {
    super(`Unknown tool: ${toolName}`);
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
  }
}

export class ToolTimeoutError extends Error {
  readonly toolName: string;
  readonly timeoutMs: number;
  constructor(toolName: string, timeoutMs: number = TOOL_TIMEOUT_MS) {
    super(`Tool "${toolName}" exceeded ${timeoutMs}ms timeout`);
    this.name = 'ToolTimeoutError';
    this.toolName = toolName;
    this.timeoutMs = timeoutMs;
  }
}

export class ToolExecutionError extends Error {
  readonly toolName: string;
  readonly toolCause: unknown;
  constructor(toolName: string, message: string, toolCause?: unknown) {
    super(`Tool "${toolName}" failed: ${message}`);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.toolCause = toolCause;
  }
}
