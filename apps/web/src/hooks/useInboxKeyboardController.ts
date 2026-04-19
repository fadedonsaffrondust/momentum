import { useEffect, useRef } from 'react';
import type { InboxEvent } from '@momentum/shared';
import { useUiStore } from '../store/ui';

interface Context {
  events: readonly InboxEvent[];
  onOpen: (event: InboxEvent) => void;
  onToggleRead: (event: InboxEvent) => void;
  onMarkAllRead: () => void;
  /** Kept in the signature for future expansion (if inbox gains modals). */
  openAssigneePickerOpen?: boolean;
}

function isTypingInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable) {
    return true;
  }
  return false;
}

const M_A_CHORD_MS = 1500;

/**
 * Inbox-scoped keyboard handler (spec §9.8). Active only on /inbox.
 *
 * j/k   — next/prev row
 * Enter — open the selected event's entity + mark read
 * Space — toggle read/unread on the selected event
 * m→a   — mark all read (chord with a 1.5s window, like the `g` prefix)
 *
 * Bails out when any modal or picker is open.
 */
export function useInboxKeyboardController(ctx: Context) {
  const activeModal = useUiStore((s) => s.activeModal);
  const assigneePickerOpen = useUiStore((s) => s.assigneePickerTarget !== null);
  const involvedPickerOpen = useUiStore((s) => s.involvedPickerTarget !== null);
  const selected = useUiStore((s) => s.selectedInboxEventId);
  const setSelected = useUiStore((s) => s.setSelectedInboxEventId);

  const mPendingRef = useRef(false);
  const mTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearChord = () => {
      mPendingRef.current = false;
      if (mTimerRef.current !== null) {
        window.clearTimeout(mTimerRef.current);
        mTimerRef.current = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isTypingInInput()) return;
      if (activeModal || assigneePickerOpen || involvedPickerOpen) {
        return;
      }

      // `m` → `a` chord = mark all read. Once `m` is pressed, the next
      // keystroke is intercepted; `a` fires the mutation, anything else
      // cancels cleanly.
      if (mPendingRef.current) {
        if (e.key === 'a') {
          e.preventDefault();
          e.stopPropagation();
          ctx.onMarkAllRead();
          clearChord();
          return;
        }
        // Any other key cancels the chord without consuming.
        clearChord();
      }
      if (e.key === 'm') {
        e.preventDefault();
        e.stopPropagation();
        mPendingRef.current = true;
        if (mTimerRef.current !== null) window.clearTimeout(mTimerRef.current);
        mTimerRef.current = window.setTimeout(clearChord, M_A_CHORD_MS);
        return;
      }

      if (ctx.events.length === 0) return;
      const currentIdx = selected ? ctx.events.findIndex((ev) => ev.id === selected) : -1;

      const move = (delta: number) => {
        const base = currentIdx < 0 ? (delta > 0 ? -1 : ctx.events.length) : currentIdx;
        const next = Math.max(0, Math.min(ctx.events.length - 1, base + delta));
        const nextEv = ctx.events[next];
        if (nextEv) setSelected(nextEv.id);
      };

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        move(1);
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
        return;
      }

      const selectedEvent = ctx.events.find((ev) => ev.id === selected);
      if (!selectedEvent) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        ctx.onOpen(selectedEvent);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        ctx.onToggleRead(selectedEvent);
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => {
      window.removeEventListener('keydown', handler, { capture: true });
      clearChord();
    };
  }, [ctx, activeModal, assigneePickerOpen, involvedPickerOpen, selected, setSelected]);
}
