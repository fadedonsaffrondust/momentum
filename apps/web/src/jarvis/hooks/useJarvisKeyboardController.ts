import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export interface UseJarvisKeyboardControllerInput {
  /**
   * Invoked by the `n` shortcut (via the `momentum:new-thing` event
   * dispatched by `useGlobalShortcuts`) to create a new conversation.
   */
  onNewConversation: () => void;
}

/**
 * Page-scoped keyboard handlers for /jarvis. Bubble-phase (global
 * shortcuts capture-phase run first and can short-circuit us by
 * consuming a key) and guarded against focused inputs so we never
 * swallow typed characters.
 *
 * Bindings (aligned with Momentum's keyboard architecture — see the
 * spec §8 edits in planning and the root CLAUDE.md canonicals):
 *   - `/` → focus the composer (`[data-jarvis-composer="true"]`). The
 *     global `/` handler looks for `[data-task-input]`, which we
 *     intentionally don't expose on the Jarvis composer — that data
 *     attribute also triggers `n` which we want to mean "new
 *     conversation", not "focus composer".
 *   - `j` / `k` → cycle focus through the conversation-list rows
 *     (`[data-jarvis-conversation-list="true"]` scope). When nothing
 *     in the list is focused, `j` focuses the first row; `k` focuses
 *     the last.
 *   - Event bridge: listens for `momentum:new-thing` on window —
 *     dispatched by `useGlobalShortcuts` when `n` is pressed and no
 *     `[data-task-input]` matches — and calls `onNewConversation()`.
 *
 * Enter / Shift+Enter / Cmd+Enter are handled inside the Composer
 * itself (they fire only when the textarea is focused, so the rules
 * belong with the component, not at the page level).
 */
export function useJarvisKeyboardController(input: UseJarvisKeyboardControllerInput): void {
  const { pathname } = useLocation();
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    if (!isJarvisPath(pathname)) return;

    const isTypingInInput = (): boolean => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const focusComposer = () => {
      const el = document.querySelector<HTMLTextAreaElement>('[data-jarvis-composer="true"]');
      el?.focus();
    };

    const cycleConversationFocus = (direction: 1 | -1) => {
      const list = document.querySelector<HTMLElement>('[data-jarvis-conversation-list="true"]');
      if (!list) return;
      const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('button'));
      if (buttons.length === 0) return;
      const active = document.activeElement as HTMLButtonElement | null;
      const currentIdx = active ? buttons.indexOf(active) : -1;

      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = direction === 1 ? 0 : buttons.length - 1;
      } else {
        nextIdx = (currentIdx + direction + buttons.length) % buttons.length;
      }
      buttons[nextIdx]?.focus();
    };

    const handler = (e: KeyboardEvent) => {
      // Global shortcuts run in capture phase and would have already
      // stopped propagation on any consumed key, so anything reaching us
      // is fair game. Still bail on modifier combos (never our business)
      // and focused inputs (user is typing).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingInInput()) return;

      if (e.key === '/') {
        e.preventDefault();
        focusComposer();
        return;
      }
      if (e.key === 'j') {
        e.preventDefault();
        cycleConversationFocus(1);
        return;
      }
      if (e.key === 'k') {
        e.preventDefault();
        cycleConversationFocus(-1);
        return;
      }
    };

    const newThingHandler = () => {
      inputRef.current.onNewConversation();
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('momentum:new-thing', newThingHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('momentum:new-thing', newThingHandler);
    };
  }, [pathname]);
}

/** Matches `/jarvis` and `/jarvis/:conversationId` — not `/jarvishidden` etc. */
export function isJarvisPath(pathname: string): boolean {
  return pathname === '/jarvis' || pathname.startsWith('/jarvis/');
}
