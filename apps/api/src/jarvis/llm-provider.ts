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

export interface StreamOptions {
  /** Called with each text-delta chunk as the LLM streams its response. */
  onTextDelta: (text: string) => void;
}

export interface LLMProvider {
  sendMessage(request: LLMRequest): Promise<LLMResponse>;
  /**
   * Streaming variant. Invokes `onTextDelta` for each token as it arrives
   * and resolves with the final, complete response when the stream
   * finishes. The returned shape is identical to `sendMessage` — callers
   * that don't care about deltas can pass a no-op callback and treat this
   * like the non-streaming method.
   */
  streamMessage(request: LLMRequest, opts: StreamOptions): Promise<LLMResponse>;
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

    return this.toResponse(response);
  }

  async streamMessage(request: LLMRequest, opts: StreamOptions): Promise<LLMResponse> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens ?? this.maxTokens,
      system: request.system,
      messages: request.messages,
      tools: request.tools,
    });

    // `text` fires per text-delta token; we just forward it. The SDK also
    // exposes `inputJson` for tool_use argument streaming, but for V1 we
    // wait until the full tool_use block is available via finalMessage
    // before executing — streaming partial JSON into a running tool
    // handler would be a footgun.
    stream.on('text', (textDelta) => opts.onTextDelta(textDelta));

    const finalMessage = await stream.finalMessage();
    return this.toResponse(finalMessage);
  }

  private toResponse(response: Anthropic.Messages.Message): LLMResponse {
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
