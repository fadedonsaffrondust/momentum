import { z } from 'zod';

/**
 * Request / response contracts for /api/jarvis. Consumed by both the
 * Fastify routes (input validation + response serialization) and the
 * web client (TanStack Query types). The SSE event shapes at the bottom
 * also drive the frontend's stream parser — changes here require a
 * matching update there.
 */

/* ─────────────── conversations ─────────────── */

export const jarvisCreateConversationInputSchema = z.object({
  /**
   * Seed message for title generation. Absent → placeholder title that
   * the user can rename later.
   */
  initialMessage: z.string().min(1).max(20_000).optional(),
});
export type JarvisCreateConversationInput = z.infer<typeof jarvisCreateConversationInputSchema>;

export const jarvisConversationSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});
export type JarvisConversationSummary = z.infer<typeof jarvisConversationSummarySchema>;

export const jarvisCreateConversationResponseSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string(),
});
export type JarvisCreateConversationResponse = z.infer<
  typeof jarvisCreateConversationResponseSchema
>;

export const jarvisListConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  /** When true, also surface soft-archived conversations. Default false. */
  includeArchived: z.coerce.boolean().default(false),
});
export type JarvisListConversationsQuery = z.infer<typeof jarvisListConversationsQuerySchema>;

/* ─────────────── messages ─────────────── */

export const jarvisMessageRoleSchema = z.enum(['user', 'assistant', 'tool']);
export type JarvisMessageRole = z.infer<typeof jarvisMessageRoleSchema>;

/**
 * Token usage recorded per assistant turn. Matches `LLMUsage` on the
 * server; duplicated in shared so the frontend can display cost /
 * performance without importing server-side types.
 */
export const jarvisTokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadInputTokens: z.number().int().nonnegative(),
  cacheCreationInputTokens: z.number().int().nonnegative(),
});
export type JarvisTokenUsage = z.infer<typeof jarvisTokenUsageSchema>;

export const jarvisMessageSchema = z.object({
  id: z.string().uuid(),
  role: jarvisMessageRoleSchema,
  /**
   * Anthropic-format content blocks. Array of `{ type, ... }` objects:
   * text blocks on role='user'/'assistant', tool_use blocks on
   * role='assistant', tool_result blocks on role='tool'. Not validated
   * shape-by-shape in the Zod schema because Anthropic's union is wide
   * (text, tool_use, tool_result, thinking, …) and the frontend
   * discriminates on `type` at render time.
   */
  content: z.unknown(),
  intent: z.string().nullable(),
  model: z.string().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  tokenUsage: jarvisTokenUsageSchema.nullable(),
  error: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type JarvisMessage = z.infer<typeof jarvisMessageSchema>;

export const jarvisConversationDetailSchema = z.object({
  conversation: jarvisConversationSummarySchema.extend({
    metadata: z.record(z.string(), z.unknown()),
  }),
  messages: z.array(jarvisMessageSchema),
});
export type JarvisConversationDetail = z.infer<typeof jarvisConversationDetailSchema>;

export const jarvisPostMessageInputSchema = z.object({
  content: z.string().min(1).max(20_000),
});
export type JarvisPostMessageInput = z.infer<typeof jarvisPostMessageInputSchema>;

/* ─────────────── SSE stream events (POST .../messages) ─────────────── */
//
// Discriminated on `type`. The frontend's streamMessage reader parses
// each SSE event line and dispatches by type. Order within a turn:
//
//   intent → (tool_call_start → tool_call_end)* → text_delta* → done
//   (or any of the above followed by `error` on failure)

export const jarvisIntentEventSchema = z.object({
  type: z.literal('intent'),
  /** Always the empty string in V1 — router is deferred to V1.5. */
  intent: z.string(),
});

export const jarvisToolCallStartEventSchema = z.object({
  type: z.literal('tool_call_start'),
  toolCallId: z.string(),
  toolName: z.string(),
  arguments: z.unknown(),
});

export const jarvisToolCallEndEventSchema = z.object({
  type: z.literal('tool_call_end'),
  toolCallId: z.string(),
  toolName: z.string(),
  latencyMs: z.number().int().nonnegative(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const jarvisTextDeltaEventSchema = z.object({
  type: z.literal('text_delta'),
  text: z.string(),
});

export const jarvisDoneEventSchema = z.object({
  type: z.literal('done'),
  messageId: z.string(),
  totalLatencyMs: z.number().int().nonnegative(),
  tokenUsage: jarvisTokenUsageSchema,
  stopReason: z.string().nullable(),
});

export const jarvisErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  name: z.string().optional(),
});

export const jarvisStreamEventSchema = z.discriminatedUnion('type', [
  jarvisIntentEventSchema,
  jarvisToolCallStartEventSchema,
  jarvisToolCallEndEventSchema,
  jarvisTextDeltaEventSchema,
  jarvisDoneEventSchema,
  jarvisErrorEventSchema,
]);
export type JarvisStreamEvent = z.infer<typeof jarvisStreamEventSchema>;
