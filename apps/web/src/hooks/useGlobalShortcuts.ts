import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUiStore } from '../store/ui';
import { useRoles } from '../api/hooks';

/**
 * App-wide keyboard shortcuts. Registered exactly once from `AppShell`,
 * so every view — including ones that don't call `useKeyboardController` —
 * gets the same global bindings.
 *
 * Runs in the capture phase and calls `stopPropagation()` on consumed keys,
 * which guarantees that page-level hooks never double-handle a shortcut.
 * This is how `g p` (go to Parkings) avoids also firing `p` (cycle priority)
 * on the currently selected task.
 */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const activeModal = useUiStore((s) => s.activeModal);
  const openModal = useUiStore((s) => s.openModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const setRoleFilter = useUiStore((s) => s.setRoleFilter);
  const rolesQ = useRoles();

  // Pending-state tracking for the `g` prefix ("go to" → t/b/p).
  const gPendingRef = useRef(false);
  const gTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearGPending = () => {
      gPendingRef.current = false;
      if (gTimerRef.current !== null) {
        window.clearTimeout(gTimerRef.current);
        gTimerRef.current = null;
      }
    };

    const isTypingInInput = (): boolean => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (el as HTMLElement).isContentEditable
      );
    };

    /**
     * Mark the event as consumed. `preventDefault` stops the browser's
     * default action (e.g. inserting a character into an input). `stopPropagation`
     * during capture phase prevents the event from reaching bubble-phase
     * listeners at all — including the page-level `useKeyboardController`.
     */
    const consume = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handler = (e: KeyboardEvent) => {
      const typing = isTypingInInput();
      const mod = e.metaKey || e.ctrlKey;

      // `/` focuses the first task/parking input bar. Works even when
      // typing into another input (matches Slack/Linear behavior).
      if (e.key === '/' && !mod && !activeModal) {
        if (!typing) {
          const target = document.querySelector<HTMLInputElement>(
            '[data-task-input="true"]',
          );
          if (target) {
            consume(e);
            target.focus();
            return;
          }
        }
        return;
      }

      // Escape: blur focused element first; otherwise close the active modal.
      if (e.key === 'Escape') {
        if (typing) {
          consume(e);
          (document.activeElement as HTMLElement | null)?.blur();
          return;
        }
        if (activeModal) {
          consume(e);
          closeModal();
          return;
        }
        return;
      }

      // Modifier-based global shortcuts.
      if (mod) {
        const k = e.key.toLowerCase();
        if (k === 'k') {
          consume(e);
          openModal('command-palette');
          return;
        }
        if (k === 'p') {
          consume(e);
          openModal('plan-my-day');
          return;
        }
        if (k === 'r') {
          consume(e);
          openModal('end-of-day');
          return;
        }
        if (k === 'w') {
          consume(e);
          openModal('weekly-stats');
          return;
        }
        if (k === 'e') {
          consume(e);
          window.dispatchEvent(new CustomEvent('momentum:export'));
          return;
        }
        if (k === 'i') {
          consume(e);
          window.dispatchEvent(new CustomEvent('momentum:import'));
          return;
        }
        if (k === 'b') {
          consume(e);
          navigate('/brands');
          return;
        }
        return;
      }

      // Past this point, shortcuts only fire when not typing and no modal
      // is open.
      if (typing || activeModal) return;

      // `?` opens the shortcuts help.
      if (e.key === '?') {
        consume(e);
        openModal('shortcuts');
        return;
      }

      // View navigation — `g` prefix (vim-style "go to") + bracket cycling.
      const VIEW_CYCLE = ['/', '/backlog', '/parkings', '/brands'];

      if (gPendingRef.current) {
        let target: string | null = null;
        if (e.key === 't') target = '/';
        else if (e.key === 'l') target = '/backlog';
        else if (e.key === 'p') target = '/parkings';
        else if (e.key === 'b') target = '/brands';

        if (target) {
          consume(e);
          navigate(target);
          clearGPending();
          return;
        }
        // Second `g` — cancel pending cleanly without re-triggering it below.
        if (e.key === 'g') {
          consume(e);
          clearGPending();
          return;
        }
        // Any other key — cancel pending and fall through.
        clearGPending();
      }

      if (e.key === 'g') {
        consume(e);
        gPendingRef.current = true;
        if (gTimerRef.current !== null) window.clearTimeout(gTimerRef.current);
        gTimerRef.current = window.setTimeout(clearGPending, 1500);
        return;
      }

      if (e.key === ']') {
        consume(e);
        const i = VIEW_CYCLE.indexOf(location.pathname);
        const next = i === -1 ? 0 : (i + 1) % VIEW_CYCLE.length;
        navigate(VIEW_CYCLE[next]!);
        return;
      }
      if (e.key === '[') {
        consume(e);
        const i = VIEW_CYCLE.indexOf(location.pathname);
        const prev = i <= 0 ? VIEW_CYCLE.length - 1 : i - 1;
        navigate(VIEW_CYCLE[prev]!);
        return;
      }

      // Role filter (1..9, 0).
      if (/^[0-9]$/.test(e.key)) {
        const roles = rolesQ.data ?? [];
        consume(e);
        if (e.key === '0') setRoleFilter(null);
        else {
          const idx = Number(e.key) - 1;
          const r = roles[idx];
          if (r) setRoleFilter(r.id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => {
      window.removeEventListener('keydown', handler, { capture: true });
      clearGPending();
    };
  }, [
    activeModal,
    openModal,
    closeModal,
    setRoleFilter,
    navigate,
    location.pathname,
    rolesQ.data,
  ]);
}
