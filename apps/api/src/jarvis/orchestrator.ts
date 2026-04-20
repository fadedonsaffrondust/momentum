import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Database } from '@momentum/db';
import type {
  LLMContentBlock,
  LLMMessageParam,
  LLMProvider,
  LLMToolDefinition,
  LLMToolUseBlock,
  LLMUsage,
} from './llm-provider.ts';
import type { AnyTool } from './tools/types.ts';
import type { JarvisLogger, ToolContext } from './tools/types.ts';
import type { ToolRegistry } from './tools/index.ts';
import { SYNTHESIS_PROMPT_V1 } from './prompts/synthesis.ts';

/**
 * Hard cap on sequential tool calls per user turn. Per the spec (§7) and
 * the architecture guardrails: "Do not raise this limit to 'let the model
 * finish what it's doing' — a runaway loop is a bug to investigate, not a
 * parameter to tune up." A breach produces a graceful fallback reply and
 * a `tool_loop_exhausted` log line.
 */
export const TOOL_LOOP_MAX = 8;

/** Hard cap on wall-clock time per user turn, in milliseconds. */
export const TURN_TIMEOUT_MS = 30_000;

const LOOP_EXHAUSTED_REPLY =
  "I'm having trouble finding what you need right now. Can you rephrase your question?";

export class TurnTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number = TURN_TIMEOUT_MS) {
    super(`Jarvis turn exceeded ${timeoutMs}ms timeout`);
    this.name = 'TurnTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export interface JarvisServiceOptions {
  llm: LLMProvider;
  registry: ToolRegistry;
  db: Database;
  /** Override `new Date()` inside handlers — used by tests and evals. */
  now?: () => Date;
  /** Override loop cap (tests). Production code should not touch this. */
  toolLoopMax?: number;
  /** Override turn timeout (tests). */
  turnTimeoutMs?: number;
}

export interface HandleMessageInput {
  userId: string;
  userMessage: string;
  /** Prior turns in this conversation. Task 5 loads this from the DB. */
  history?: LLMMessageParam[];
  logger: JarvisLogger;
}

export interface ToolCallRecord {
  name: string;
  input: unknown;
  result: unknown;
  error: string | null;
  latencyMs: number;
}

export interface HandleMessageResult {
  /** The final assistant text the user sees. Flattened across any text blocks. */
  assistantText: string;
  /** Every assistant content block produced during the turn, in order. */
  assistantContent: LLMContentBlock[];
  /** Flat record of every tool invocation — order matches the SSE stream. */
  toolCalls: ToolCallRecord[];
  /** Summed Anthropic usage across every LLM call this turn. */
  usage: LLMUsage;
  /**
   * The stop_reason from the final LLM call, or the sentinel
   * `'tool_loop_exhausted'` when the orchestrator cuts the loop off.
   */
  stopReason: string | null;
  /** True when the loop was cut off by TOOL_LOOP_MAX rather than end_turn. */
  loopExhausted: boolean;
}

/**
 * JarvisService owns the conversation loop. It is the only component that
 * talks to the LLM directly (per the guardrails). Does not read the DB
 * itself — tools do that via `ctx.db`. Persistence lands in Task 5.
 */
export class JarvisService {
  private readonly opts: Required<Omit<JarvisServiceOptions, 'now'>> & {
    now: () => Date;
  };

  constructor(opts: JarvisServiceOptions) {
    this.opts = {
      llm: opts.llm,
      registry: opts.registry,
      db: opts.db,
      now: opts.now ?? (() => new Date()),
      toolLoopMax: opts.toolLoopMax ?? TOOL_LOOP_MAX,
      turnTimeoutMs: opts.turnTimeoutMs ?? TURN_TIMEOUT_MS,
    };
  }

  async handleMessage(input: HandleMessageInput): Promise<HandleMessageResult> {
    const ctx: ToolContext = {
      userId: input.userId,
      now: this.opts.now(),
      db: this.opts.db,
      logger: input.logger,
    };

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new TurnTimeoutError(this.opts.turnTimeoutMs)),
        this.opts.turnTimeoutMs,
      );
    });

    try {
      return await Promise.race([this.runLoop(input, ctx), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async runLoop(input: HandleMessageInput, ctx: ToolContext): Promise<HandleMessageResult> {
    const messages: LLMMessageParam[] = [
      ...(input.history ?? []),
      { role: 'user', content: input.userMessage },
    ];

    const tools = this.opts.registry.getAllTools().map(toolToAnthropic);
    const toolCalls: ToolCallRecord[] = [];
    const usage = emptyUsage();
    let lastContent: LLMContentBlock[] = [];
    let lastStopReason: string | null = null;

    for (let iter = 0; iter < this.opts.toolLoopMax; iter++) {
      const response = await this.opts.llm.sendMessage({
        system: SYNTHESIS_PROMPT_V1,
        // Shallow-copy so we don't hand the LLM provider a mutable
        // reference that keeps growing under it mid-turn. The SDK would
        // serialize anyway, but keeping the boundary defensive lets
        // tests (and any future provider) observe a stable snapshot.
        messages: [...messages],
        tools,
      });
      lastContent = response.content;
      lastStopReason = response.stopReason;
      addUsage(usage, response.usage);

      if (response.stopReason === 'end_turn' || response.stopReason === 'stop_sequence') {
        return {
          assistantText: extractAssistantText(response.content),
          assistantContent: response.content,
          toolCalls,
          usage,
          stopReason: response.stopReason,
          loopExhausted: false,
        };
      }

      const toolUseBlocks = response.content.filter(
        (b): b is LLMToolUseBlock => b.type === 'tool_use',
      );
      if (toolUseBlocks.length === 0) {
        // Unexpected stop_reason (e.g. `max_tokens`, `pause_turn`,
        // `refusal`) with no tools to run. Return what we have.
        return {
          assistantText: extractAssistantText(response.content),
          assistantContent: response.content,
          toolCalls,
          usage,
          stopReason: response.stopReason,
          loopExhausted: false,
        };
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic_ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        const record = await this.executeToolForLoop(block, ctx);
        toolCalls.push(record);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: record.error ? record.error : serializeToolResult(record.result),
          ...(record.error ? { is_error: true as const } : {}),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    input.logger.error(
      {
        userId: input.userId,
        toolLoopMax: this.opts.toolLoopMax,
        toolCallCount: toolCalls.length,
      },
      'jarvis tool loop exhausted',
    );

    return {
      assistantText: LOOP_EXHAUSTED_REPLY,
      assistantContent: lastContent,
      toolCalls,
      usage,
      stopReason: 'tool_loop_exhausted',
      loopExhausted: true,
    };
  }

  private async executeToolForLoop(
    block: LLMToolUseBlock,
    ctx: ToolContext,
  ): Promise<ToolCallRecord> {
    const startedAt = Date.now();
    try {
      const result = await this.opts.registry.executeTool(block.name, block.input, ctx);
      return {
        name: block.name,
        input: block.input,
        result,
        error: null,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        name: block.name,
        input: block.input,
        result: null,
        error: message,
        latencyMs: Date.now() - startedAt,
      };
    }
  }
}

/* ─────────────── helpers ─────────────── */

// Re-declared narrowly to avoid importing the deep Anthropic namespace
// here. Matches the SDK's ToolResultBlockParam shape the API expects.
type Anthropic_ToolResultBlockParam = {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: true;
};

export function toolToAnthropic(tool: AnyTool): LLMToolDefinition {
  const schema = zodToJsonSchema(tool.inputSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, unknown>;

  // Anthropic requires `input_schema` to be a JSON Schema with a top-level
  // `type: 'object'` (and at minimum `properties`). zod-to-json-schema
  // produces that shape for z.object(...), but strip Zod / zod-to-json
  // metadata like `$schema` that Anthropic flags as extra.
  const { $schema, additionalProperties, ...rest } = schema;
  return {
    name: tool.name,
    description: tool.description,
    input_schema: rest as LLMToolDefinition['input_schema'],
  };
}

export function extractAssistantText(content: LLMContentBlock[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text);
  }
  return parts.join('\n').trim();
}

function serializeToolResult(result: unknown): string {
  // Tool handlers already return JSON-serializable shapes by contract (see
  // tools/CLAUDE.md guardrails). We just stringify.
  return JSON.stringify(result);
}

function emptyUsage(): LLMUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };
}

function addUsage(acc: LLMUsage, delta: LLMUsage): void {
  acc.inputTokens += delta.inputTokens;
  acc.outputTokens += delta.outputTokens;
  acc.cacheReadInputTokens += delta.cacheReadInputTokens;
  acc.cacheCreationInputTokens += delta.cacheCreationInputTokens;
}
