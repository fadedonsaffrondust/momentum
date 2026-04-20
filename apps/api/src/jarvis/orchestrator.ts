import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Database } from '@momentum/db';
import type { JarvisStreamEvent } from '@momentum/shared';
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
import { buildPersistence, type JarvisPersistence } from './persistence/index.ts';
import type { MessageRow } from './persistence/messages.ts';

export type JarvisStreamCallback = (event: JarvisStreamEvent) => void;
const NOOP_STREAM: JarvisStreamCallback = () => {};

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
  /**
   * Override the default Drizzle-backed persistence. Tests inject a fake
   * surface; production code lets the orchestrator build one from `db`.
   */
  persistence?: JarvisPersistence;
  /** Override `new Date()` inside handlers — used by tests and evals. */
  now?: () => Date;
  /** Override loop cap (tests). Production code should not touch this. */
  toolLoopMax?: number;
  /** Override turn timeout (tests). */
  turnTimeoutMs?: number;
  /** How many historical messages to load for the LLM context window. */
  historyLimit?: number;
}

export interface HandleMessageInput {
  /** Conversation the turn belongs to. Route layer has already verified ownership. */
  conversationId: string;
  userId: string;
  userMessage: string;
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
  /** Id of the last persisted assistant message; surfaced in the SSE `done` event. */
  lastAssistantMessageId: string | null;
}

/**
 * JarvisService owns the conversation loop. It is the only component that
 * talks to the LLM directly (per the guardrails). Does not read the DB
 * itself — tools do that via `ctx.db`. Persistence lands in Task 5.
 */
/** Default history window in messages — matches spec §7 context budget. */
export const DEFAULT_HISTORY_LIMIT = 20;

export class JarvisService {
  private readonly opts: Required<Omit<JarvisServiceOptions, 'now' | 'persistence'>> & {
    now: () => Date;
    persistence: JarvisPersistence;
  };

  constructor(opts: JarvisServiceOptions) {
    this.opts = {
      llm: opts.llm,
      registry: opts.registry,
      db: opts.db,
      persistence: opts.persistence ?? buildPersistence(opts.db),
      now: opts.now ?? (() => new Date()),
      toolLoopMax: opts.toolLoopMax ?? TOOL_LOOP_MAX,
      turnTimeoutMs: opts.turnTimeoutMs ?? TURN_TIMEOUT_MS,
      historyLimit: opts.historyLimit ?? DEFAULT_HISTORY_LIMIT,
    };
  }

  /** Non-streaming handler — used by evals, CLI tooling, and tests. */
  async handleMessage(input: HandleMessageInput): Promise<HandleMessageResult> {
    return this.runTurn(input, NOOP_STREAM, false);
  }

  /**
   * Streaming handler used by the SSE route. Emits the V1 event types
   * (intent, tool_call_start/end, text_delta, done, error) as the turn
   * progresses. Resolves with the same HandleMessageResult shape as
   * handleMessage so callers that don't need SSE can treat the two
   * interchangeably.
   */
  async streamMessage(
    input: HandleMessageInput,
    onEvent: JarvisStreamCallback,
  ): Promise<HandleMessageResult> {
    // V1 emits `intent` as an empty-string marker so the client parser
    // stays future-proof for when the router (V1.5) lands.
    onEvent({ type: 'intent', intent: '' });

    const startedAt = Date.now();
    try {
      const result = await this.runTurn(input, onEvent, true);
      onEvent({
        type: 'done',
        messageId: result.lastAssistantMessageId ?? '',
        totalLatencyMs: Date.now() - startedAt,
        tokenUsage: result.usage,
        stopReason: result.stopReason,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : undefined;
      onEvent({ type: 'error', message, ...(name ? { name } : {}) });
      throw err;
    }
  }

  private async runTurn(
    input: HandleMessageInput,
    onEvent: JarvisStreamCallback,
    streaming: boolean,
  ): Promise<HandleMessageResult> {
    const ctx: ToolContext = {
      userId: input.userId,
      now: this.opts.now(),
      db: this.opts.db,
      logger: input.logger,
    };

    // Persist the user's turn first — even if everything downstream
    // explodes (LLM outage, turn timeout), the conversation shows the
    // user did reach out. Spec §5: "On error mid-loop, partial messages
    // are still persisted."
    await this.opts.persistence.insertMessage({
      conversationId: input.conversationId,
      role: 'user',
      content: [{ type: 'text', text: input.userMessage }],
    });

    // Load recent history for the LLM context window. Includes the user
    // message we just inserted.
    const historyRows = await this.opts.persistence.listMessagesByConversation(
      input.conversationId,
      this.opts.historyLimit,
    );
    const anthropicMessages = historyRows.map(dbMessageToAnthropic);

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new TurnTimeoutError(this.opts.turnTimeoutMs)),
        this.opts.turnTimeoutMs,
      );
    });

    try {
      const result = await Promise.race([
        this.runLoop(input, ctx, anthropicMessages, onEvent, streaming),
        timeoutPromise,
      ]);
      await this.opts.persistence.bumpConversationUpdatedAt(input.conversationId);
      return result;
    } catch (err) {
      // Best-effort: record the failure as an assistant-side marker so the
      // conversation doesn't silently end. Swallow persistence errors on
      // this path — we're already bubbling the primary failure up.
      try {
        await this.opts.persistence.insertMessage({
          conversationId: input.conversationId,
          role: 'assistant',
          content: [],
          error: serializeError(err),
        });
        await this.opts.persistence.bumpConversationUpdatedAt(input.conversationId);
      } catch (persistErr) {
        input.logger.error(
          { err: persistErr },
          'jarvis: failed to persist error marker after turn failure',
        );
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async runLoop(
    input: HandleMessageInput,
    ctx: ToolContext,
    anthropicMessages: LLMMessageParam[],
    onEvent: JarvisStreamCallback,
    streaming: boolean,
  ): Promise<HandleMessageResult> {
    const messages: LLMMessageParam[] = [...anthropicMessages];

    const tools = this.opts.registry.getAllTools().map(toolToAnthropic);
    const toolCalls: ToolCallRecord[] = [];
    const usage = emptyUsage();
    let lastContent: LLMContentBlock[] = [];
    let lastStopReason: string | null = null;
    let lastAssistantMessageId: string | null = null;

    for (let iter = 0; iter < this.opts.toolLoopMax; iter++) {
      const llmStartedAt = Date.now();
      // Shallow-copy `messages` so we don't hand the LLM provider a
      // mutable reference that keeps growing under it mid-turn. The SDK
      // would serialize anyway, but keeping the boundary defensive lets
      // tests (and any future provider) observe a stable snapshot.
      const llmRequest = {
        system: SYNTHESIS_PROMPT_V1,
        messages: [...messages],
        tools,
      };
      const response = streaming
        ? await this.opts.llm.streamMessage(llmRequest, {
            onTextDelta: (text) => onEvent({ type: 'text_delta', text }),
          })
        : await this.opts.llm.sendMessage(llmRequest);
      const llmLatencyMs = Date.now() - llmStartedAt;
      lastContent = response.content;
      lastStopReason = response.stopReason;
      addUsage(usage, response.usage);

      // Persist the assistant turn before executing tools. Tool-call rows
      // (below) FK to this message, so the insert has to happen first.
      const assistantRow = await this.opts.persistence.insertMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: response.content,
        model: response.model,
        latencyMs: llmLatencyMs,
        tokenUsage: response.usage,
      });
      lastAssistantMessageId = assistantRow.id;

      if (response.stopReason === 'end_turn' || response.stopReason === 'stop_sequence') {
        return {
          assistantText: extractAssistantText(response.content),
          assistantContent: response.content,
          toolCalls,
          usage,
          stopReason: response.stopReason,
          loopExhausted: false,
          lastAssistantMessageId,
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
          lastAssistantMessageId,
        };
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic_ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        onEvent({
          type: 'tool_call_start',
          toolCallId: block.id,
          toolName: block.name,
          arguments: block.input,
        });
        const record = await this.executeToolForLoop(block, ctx);
        toolCalls.push(record);
        onEvent({
          type: 'tool_call_end',
          toolCallId: block.id,
          toolName: record.name,
          latencyMs: record.latencyMs,
          success: record.error === null,
          ...(record.error ? { error: record.error } : {}),
        });
        await this.opts.persistence.insertToolCall({
          messageId: assistantRow.id,
          toolName: record.name,
          arguments: record.input,
          result: record.result,
          error: record.error,
          latencyMs: record.latencyMs,
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: record.error ? record.error : serializeToolResult(record.result),
          ...(record.error ? { is_error: true as const } : {}),
        });
      }

      // Persist the tool-results batch as role='tool' so replay reconstructs
      // the exact Anthropic message sequence. Mapped back to role='user'
      // in dbMessageToAnthropic on the next turn's context build.
      await this.opts.persistence.insertMessage({
        conversationId: input.conversationId,
        role: 'tool',
        content: toolResults,
      });

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
      lastAssistantMessageId,
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

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { name: 'Unknown', message: String(err) };
}

/**
 * Map a stored jarvis_messages row back into the Anthropic message shape
 * the SDK expects. `role='tool'` in DB is our convention for a
 * tool_result-bearing user message in Anthropic's format — mapped back
 * to `role='user'` here so the SDK accepts it.
 */
export function dbMessageToAnthropic(row: MessageRow): LLMMessageParam {
  if (row.role === 'assistant') {
    return { role: 'assistant', content: row.content } as LLMMessageParam;
  }
  // Both 'user' text messages and 'tool' tool_result messages are Anthropic
  // `user` messages — `role='tool'` is our DB-internal convention for
  // tool_result-bearing user messages.
  return { role: 'user', content: row.content } as LLMMessageParam;
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
