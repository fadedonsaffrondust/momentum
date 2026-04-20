import { describe, it, expect } from 'vitest';
import type { JarvisStreamEvent } from '@momentum/shared';
import { INITIAL_TURN_STATE, turnReducer, type TurnState } from './messageReducer';

function initial(): TurnState {
  return INITIAL_TURN_STATE;
}

describe('turnReducer', () => {
  it('submit → streaming, with optimistic user message', () => {
    const next = turnReducer(initial(), { type: 'submit', content: 'hello' });
    expect(next.status).toBe('streaming');
    expect(next.optimisticUserMessage).toBe('hello');
    expect(next.assistantText).toBe('');
    expect(next.toolCalls).toEqual([]);
  });

  it('intent event is a no-op (advisory in V1)', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'hi' },
      { type: 'sse', event: { type: 'intent', intent: '' } },
    ]);
    expect(after.status).toBe('streaming');
    expect(after.assistantText).toBe('');
  });

  it('text_delta events accumulate into assistantText', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'hi' },
      { type: 'sse', event: { type: 'text_delta', text: 'Hello ' } },
      { type: 'sse', event: { type: 'text_delta', text: 'world' } },
    ]);
    expect(after.assistantText).toBe('Hello world');
  });

  it('tool_call_start appends a pending pill', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'go' },
      {
        type: 'sse',
        event: {
          type: 'tool_call_start',
          toolCallId: 'tu_1',
          toolName: 'getMyTasks',
          arguments: { limit: 5 },
        },
      },
    ]);
    expect(after.toolCalls).toHaveLength(1);
    expect(after.toolCalls[0]).toMatchObject({
      toolCallId: 'tu_1',
      toolName: 'getMyTasks',
      status: 'pending',
    });
  });

  it('tool_call_end resolves the matching pill, keeps others unchanged', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'go' },
      {
        type: 'sse',
        event: {
          type: 'tool_call_start',
          toolCallId: 'tu_1',
          toolName: 'getMyTasks',
          arguments: {},
        },
      },
      {
        type: 'sse',
        event: {
          type: 'tool_call_start',
          toolCallId: 'tu_2',
          toolName: 'getBrand',
          arguments: { brandId: 'b' },
        },
      },
      {
        type: 'sse',
        event: {
          type: 'tool_call_end',
          toolCallId: 'tu_1',
          toolName: 'getMyTasks',
          latencyMs: 15,
          success: true,
        },
      },
    ]);
    expect(after.toolCalls[0]).toMatchObject({ status: 'success', latencyMs: 15 });
    expect(after.toolCalls[1]).toMatchObject({ status: 'pending', latencyMs: null });
  });

  it('tool_call_end with success=false resolves to error status', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'go' },
      {
        type: 'sse',
        event: {
          type: 'tool_call_start',
          toolCallId: 'tu_1',
          toolName: 'getMyTasks',
          arguments: {},
        },
      },
      {
        type: 'sse',
        event: {
          type: 'tool_call_end',
          toolCallId: 'tu_1',
          toolName: 'getMyTasks',
          latencyMs: 3,
          success: false,
          error: 'invalid arguments',
        },
      },
    ]);
    expect(after.toolCalls[0]).toMatchObject({
      status: 'error',
      error: 'invalid arguments',
    });
  });

  it('done event captures messageId + usage + stopReason and flips status', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'go' },
      { type: 'sse', event: { type: 'text_delta', text: 'OK' } },
      {
        type: 'sse',
        event: {
          type: 'done',
          messageId: 'msg-42',
          totalLatencyMs: 250,
          tokenUsage: {
            inputTokens: 10,
            outputTokens: 5,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
          },
          stopReason: 'end_turn',
        },
      },
    ]);
    expect(after.status).toBe('done');
    expect(after.done).toEqual({
      messageId: 'msg-42',
      totalLatencyMs: 250,
      tokenUsage: {
        inputTokens: 10,
        outputTokens: 5,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
      stopReason: 'end_turn',
    });
    expect(after.assistantText).toBe('OK');
  });

  it('error event from the stream flips status and carries the message', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'go' },
      {
        type: 'sse',
        event: { type: 'error', message: 'LLM unavailable', name: 'UpstreamError' },
      },
    ]);
    expect(after.status).toBe('error');
    expect(after.error).toEqual({ message: 'LLM unavailable', name: 'UpstreamError' });
  });

  it('fail action (non-SSE client-side failure) flips to error', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'go' },
      { type: 'fail', message: 'network down' },
    ]);
    expect(after.status).toBe('error');
    expect(after.error).toEqual({ message: 'network down' });
  });

  it('reset returns to idle and clears everything', () => {
    const after = reduceSequence([
      { type: 'submit', content: 'go' },
      { type: 'sse', event: { type: 'text_delta', text: 'hi' } },
      { type: 'reset' },
    ]);
    expect(after).toEqual(INITIAL_TURN_STATE);
  });
});

function reduceSequence(actions: Parameters<typeof turnReducer>[1][]): TurnState {
  let state = initial();
  for (const action of actions) state = turnReducer(state, action);
  return state;
}

// Re-export the type alias to keep the import tidy.
export type { JarvisStreamEvent };
