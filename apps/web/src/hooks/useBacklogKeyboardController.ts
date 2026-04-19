import { useEffect } from 'react';
import type { Task } from '@momentum/shared';
import { useUiStore } from '../store/ui';

interface Context {
  /** Tasks in rendered order across all backlog groups. */
  tasks: readonly Task[];
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

/**
 * Backlog-scoped keyboard handler. Active only on /backlog.
 *
 * j/k — next/prev task (flat across groups)
 * e   — open task detail drawer
 */
export function useBacklogKeyboardController(ctx: Context) {
  const activeModal = useUiStore((s) => s.activeModal);
  const assigneePickerOpen = useUiStore((s) => s.assigneePickerTarget !== null);
  const involvedPickerOpen = useUiStore((s) => s.involvedPickerTarget !== null);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const openDrawer = useUiStore((s) => s.openDrawer);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isTypingInInput()) return;
      if (activeModal || assigneePickerOpen || involvedPickerOpen) return;
      if (ctx.tasks.length === 0) return;

      const currentIdx = ctx.tasks.findIndex((t) => t.id === selectedTaskId);

      const move = (delta: number) => {
        const base = currentIdx < 0 ? (delta > 0 ? -1 : ctx.tasks.length) : currentIdx;
        const nextIdx = Math.max(0, Math.min(ctx.tasks.length - 1, base + delta));
        const next = ctx.tasks[nextIdx];
        if (next) setSelectedTaskId(next.id);
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

      const selected = ctx.tasks.find((t) => t.id === selectedTaskId);
      if (!selected) return;

      if (e.key === 'e') {
        e.preventDefault();
        openDrawer();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    ctx,
    activeModal,
    assigneePickerOpen,
    involvedPickerOpen,
    openDrawer,
    selectedTaskId,
    setSelectedTaskId,
  ]);
}
