import Anthropic from '@anthropic-ai/sdk';

/**
 * LLM provider abstraction. V1 ships only `AnthropicProvider` (see the
 * guardrails file — "Single LLM provider in V1"), but the interface
 * exists so a V1.5+ router-on-Haiku or OpenAI implementation slots in
 * without touching the orchestrator.
 *
 * The request/response shapes here are intentionally Anthropic-shaped:
 * V1 is committed to Anthropic, and a future provider will need a
 * translation layer regardless. Keeping the boundary honest avoids the
 * trap of an abstraction that hides what's actually happening.
 */
export type LLMMessageParam = Anthropic.Messages.MessageParam;
export type LLMContentBlock = Anthropic.Messages.ContentBlock;
export type LLMTextBlock = Anthropic.Messages.TextBlock;
export type LLMToolUseBlock = Anthropic.Messages.ToolUseBlock;
export type LLMToolDefinition = Anthropic.Messages.Tool;
export type LLMStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | 'pause_turn'
  | 'refusal'
  | null;

export interface LLMRequest {
  /** Static preamble. Will become an array of cache-partitioned blocks in Task 9. */
  system: string;
  messages: LLMMessageParam[];
  tools: LLMToolDefinition[];
  maxTokens?: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface LLMResponse {
  id: string;
  model: string;
  stopReason: LLMStopReason;
  content: LLMContentBlock[];
  usage: LLMUsage;
}

export interface LLMProvider {
  sendMessage(request: LLMRequest): Promise<LLMResponse>;
  // Streaming (`streamMessage`) lands in Task 6. The orchestrator
  // currently only calls `sendMessage`.
}

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_MAX_TOKENS = 4096;

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(opts: AnthropicProviderOptions) {
    if (!opts.apiKey) {
      throw new Error(
        'AnthropicProvider requires an apiKey. Set ANTHROPIC_API_KEY in your environment.',
      );
    }
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
    this.maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async sendMessage(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? this.maxTokens,
      system: request.system,
      messages: request.messages,
      tools: request.tools,
    });

    return {
      id: response.id,
      model: response.model,
      stopReason: response.stop_reason as LLMStopReason,
      content: response.content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}
