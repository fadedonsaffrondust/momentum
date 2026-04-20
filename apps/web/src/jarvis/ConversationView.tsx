import { useEffect, useReducer, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { INITIAL_TURN_STATE, turnReducer, type TurnState } from './messageReducer';
import { streamMessage, StreamMessageError } from './streamMessage';
import { jarvisKeys, useJarvisConversation } from './api/conversations';

export interface ConversationViewProps {
  conversationId: string;
  /**
   * If present, auto-post as the first user message when the view
   * mounts. Used by the empty-state prompt cards — they create a
   * conversation and forward the seed prompt via this prop so the
   * assistant starts streaming immediately.
   */
  initialMessage?: string | null;
}

/**
 * Task 8 ties the whole streaming chat together. Historical messages
 * come from `useJarvisConversation`; the in-flight turn lives in the
 * reducer; `streamMessage` drives SSE events into the reducer. On
 * `done`, we refetch conversation detail so the persisted turn replaces
 * the ephemeral state seamlessly.
 */
export function ConversationView({ conversationId, initialMessage }: ConversationViewProps) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const detailQ = useJarvisConversation(conversationId);

  const [liveTurn, dispatch] = useReducer(turnReducer, INITIAL_TURN_STATE);
  const [composerValue, setComposerValue] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const autoPostedRef = useRef<string | null>(null);

  // After a turn completes: wait for the detail query to refetch with
  // the persisted messages, then clear the ephemeral state. Otherwise
  // the just-finished turn briefly double-renders (live copy + historical
  // copy) after the invalidation lands. Also invalidate the list so the
  // sidebar picks up any server-side title/timestamp change (e.g. the
  // first message of a conversation that was created with the
  // placeholder "New conversation" title).
  useEffect(() => {
    if (liveTurn.status !== 'done') return;
    let cancelled = false;
    void qc.invalidateQueries({ queryKey: jarvisKeys.conversation(conversationId) }).then(() => {
      if (!cancelled) dispatch({ type: 'reset' });
    });
    void qc.invalidateQueries({ queryKey: jarvisKeys.conversations });
    return () => {
      cancelled = true;
    };
  }, [liveTurn.status, qc, conversationId]);

  // Navigating away used to trigger an abort of any in-flight stream,
  // but React StrictMode's dev-only setup → cleanup → setup double-
  // invoke fires that cleanup mid-mount and cancels the controller the
  // auto-post effect (below) just created — the fetch aborts before it
  // hits the wire, the assistant sits on "Thinking…", and no /messages
  // request ever lands. handleSubmit still aborts any previous
  // controller when the user sends another message, so intra-turn
  // cancellation is still correct; the one case we give up is
  // "cancel the LLM call when the user clicks away mid-stream", which
  // V1 accepts — the stream completes to the server, the persisted
  // turn lands in the conversation, and the abandoned component's
  // state updates are no-ops because React skips them on unmounted
  // instances. See the Task 13 follow-up in docs/JARVIS-TODOS.md if we
  // want true navigation-cancel back (needs a StrictMode-aware guard).

  const handleSubmit = async (content: string) => {
    setComposerValue('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'submit', content });
    try {
      await streamMessage({
        conversationId,
        content,
        token,
        signal: controller.signal,
        onEvent: (event) => dispatch({ type: 'sse', event }),
      });
    } catch (err) {
      if (controller.signal.aborted) return; // navigation away, silent
      const message =
        err instanceof StreamMessageError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong';
      const name = err instanceof Error ? err.name : undefined;
      dispatch({ type: 'fail', message, name });
    }
  };

  const handleRetry = () => {
    const last = liveTurn.optimisticUserMessage;
    if (!last) return;
    void handleSubmit(last);
  };

  // Auto-post the seed prompt exactly once per conversation.
  useEffect(() => {
    if (!initialMessage) return;
    if (autoPostedRef.current === conversationId) return;
    autoPostedRef.current = conversationId;
    void handleSubmit(initialMessage);
    // Intentionally not including handleSubmit in deps — it closes over
    // state we don't want to chase; stable conversationId + initialMessage
    // guard is enough to fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, initialMessage]);

  const historical = detailQ.data?.messages ?? [];
  const canRetry = liveTurn.status === 'error' && liveTurn.optimisticUserMessage !== null;

  return (
    <>
      <MessageList historical={historical} liveTurn={liveTurn} />
      {canRetry ? (
        <RetryBar onRetry={handleRetry} errorName={liveTurn.error?.name ?? null} />
      ) : null}
      <Composer
        value={composerValue}
        onChange={setComposerValue}
        onSubmit={handleSubmit}
        isBusy={isInFlight(liveTurn)}
      />
    </>
  );
}

function isInFlight(state: TurnState): boolean {
  return state.status === 'streaming' || state.status === 'done';
}

/**
 * Inline strip below the transcript when a turn fails. Copy is tuned to
 * the server's error name so timeouts and everything-else read
 * differently — timeouts are a wait-and-try-again situation, the rest
 * are opaque-failure.
 */
function RetryBar({ onRetry, errorName }: { onRetry: () => void; errorName: string | null }) {
  const isTimeout = errorName === 'TurnTimeoutError';
  return (
    <div className="flex items-center justify-center border-t border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
      <span className="mr-2">
        {isTimeout
          ? 'Jarvis took too long to answer. Try again — usually a retry goes through faster.'
          : "The assistant didn't finish. You can retry the last message."}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-destructive/40 px-2 py-0.5 font-medium hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        Retry
      </button>
    </div>
  );
}
