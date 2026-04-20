import type { JarvisStreamEvent, JarvisTokenUsage } from '@momentum/shared';

/**
 * Reducer tracking the in-flight turn on the frontend. Historical
 * messages come from TanStack Query (`useJarvisConversation`); this
 * reducer only handles what the user + assistant are doing *right now*.
 *
 * Lifecycle:
 *   idle
 *     ↓ submit(content)        user posts a message, optimistic append
 *   streaming
 *     ↓ text_delta*            accumulates assistantText
 *     ↓ tool_call_start        adds pending pill (status: 'pending')
 *     ↓ tool_call_end          resolves the pill (success | error)
 *     ↓ done                   → done  (totalLatency + messageId captured)
 *     ↓ error                  → error (inline retry surface)
 *   done | error
 *     ↓ reset                  back to idle (called after query refetch)
 */

export type LiveToolCallStatus = 'pending' | 'success' | 'error';

export interface LiveToolCall {
  toolCallId: string;
  toolName: string;
  /** Arguments the LLM passed. Stored for the "expand" view on the pill. */
  arguments: unknown;
  status: LiveToolCallStatus;
  latencyMs: number | null;
  error: string | null;
}

export type TurnStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface TurnState {
  status: TurnStatus;
  /** Optimistic user message — echoed at the bottom of the conversation while streaming. */
  optimisticUserMessage: string | null;
  /** Text assistant has produced so far this turn (concatenated text_deltas). */
  assistantText: string;
  /** Tool calls in flight or resolved this turn, in emission order. */
  toolCalls: LiveToolCall[];
  done: {
    messageId: string;
    totalLatencyMs: number;
    tokenUsage: JarvisTokenUsage;
    stopReason: string | null;
  } | null;
  error: { message: string; name?: string } | null;
}

export const INITIAL_TURN_STATE: TurnState = {
  status: 'idle',
  optimisticUserMessage: null,
  assistantText: '',
  toolCalls: [],
  done: null,
  error: null,
};

export type TurnAction =
  | { type: 'submit'; content: string }
  | { type: 'sse'; event: JarvisStreamEvent }
  | { type: 'fail'; message: string; name?: string }
  | { type: 'reset' };

export function turnReducer(state: TurnState, action: TurnAction): TurnState {
  switch (action.type) {
    case 'submit':
      return {
        ...INITIAL_TURN_STATE,
        status: 'streaming',
        optimisticUserMessage: action.content,
      };

    case 'reset':
      return INITIAL_TURN_STATE;

    case 'fail':
      return {
        ...state,
        status: 'error',
        error: { message: action.message, ...(action.name ? { name: action.name } : {}) },
      };

    case 'sse': {
      return applyStreamEvent(state, action.event);
    }

    default:
      return state;
  }
}

function applyStreamEvent(state: TurnState, event: JarvisStreamEvent): TurnState {
  switch (event.type) {
    case 'intent':
      // V1: intent is advisory and always empty. We accept the event to
      // preserve event-ordering invariants but don't store anything.
      return state;

    case 'text_delta':
      return { ...state, assistantText: state.assistantText + event.text };

    case 'tool_call_start':
      return {
        ...state,
        toolCalls: [
          ...state.toolCalls,
          {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            arguments: event.arguments,
            status: 'pending',
            latencyMs: null,
            error: null,
          },
        ],
      };

    case 'tool_call_end':
      return {
        ...state,
        toolCalls: state.toolCalls.map((tc) =>
          tc.toolCallId === event.toolCallId
            ? {
                ...tc,
                status: event.success ? 'success' : 'error',
                latencyMs: event.latencyMs,
                error: event.error ?? null,
              }
            : tc,
        ),
      };

    case 'done':
      return {
        ...state,
        status: 'done',
        done: {
          messageId: event.messageId,
          totalLatencyMs: event.totalLatencyMs,
          tokenUsage: event.tokenUsage,
          stopReason: event.stopReason,
        },
      };

    case 'error':
      return {
        ...state,
        status: 'error',
        error: { message: event.message, ...(event.name ? { name: event.name } : {}) },
      };

    default:
      return state;
  }
}
