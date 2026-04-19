import { useEffect } from 'react';
import type { Task } from '@momentum/shared';
import { useUiStore } from '../store/ui';

interface Section {
  userId: string;
  tasks: Task[];
}

interface Context {
  sections: readonly Section[];
  onCycleScope: () => void;
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
 * Team-view-scoped keyboard handler (post-redesign). The view is now a
 * horizontal board with one column per teammate, so nav is two-dimensional:
 *
 * j/k   — next / prev task within the focused teammate's flat list
 * h/l   — prev / next teammate column (select that column's first task)
 * ]/[   — aliases for h/l; hijack the global view-cycle on /team
 * f     — cycle date scope (today → week → all)
 * e     — open the task detail drawer
 * A     — open the assignee picker for the selected task
 *
 * Progression keys (Enter / Space) are intentionally not bound on Team —
 * those are Today-only. Team is overview + metadata, not a remote-control
 * for other people's tasks. The backend action routes already restrict to
 * the assignee, so binding them here would either 404 or let you progress
 * your own tasks from the wrong surface.
 *
 * The handler uses capture-phase so ] / [ can intercept before the global
 * view-cycle fires. Falls through when a modal or picker is open.
 */
export function useTeamKeyboardController(ctx: Context) {
  const activeModal = useUiStore((s) => s.activeModal);
  const assigneePickerOpen = useUiStore((s) => s.assigneePickerTarget !== null);
  const involvedPickerOpen = useUiStore((s) => s.involvedPickerTarget !== null);
  const openAssigneePicker = useUiStore((s) => s.openAssigneePicker);

  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const openDrawer = useUiStore((s) => s.openDrawer);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isTypingInInput()) return;
      if (activeModal || assigneePickerOpen || involvedPickerOpen) return;
      if (ctx.sections.length === 0) return;

      // Focused section = the section containing the selected task, or the
      // first one if nothing is selected.
      const focusedSectionIdx = (() => {
        if (!selectedTaskId) return 0;
        for (let i = 0; i < ctx.sections.length; i++) {
          if (ctx.sections[i]!.tasks.some((t) => t.id === selectedTaskId)) return i;
        }
        return 0;
      })();

      const section = ctx.sections[focusedSectionIdx]!;
      const currentIdx = section.tasks.findIndex((t) => t.id === selectedTaskId);

      const moveWithin = (delta: number) => {
        if (section.tasks.length === 0) return;
        const base = currentIdx < 0 ? (delta > 0 ? -1 : section.tasks.length) : currentIdx;
        const next = Math.max(0, Math.min(section.tasks.length - 1, base + delta));
        const nextTask = section.tasks[next];
        if (nextTask) setSelectedTaskId(nextTask.id);
      };

      const moveSection = (delta: number) => {
        const nextIdx = Math.max(0, Math.min(ctx.sections.length - 1, focusedSectionIdx + delta));
        const nextSec = ctx.sections[nextIdx];
        if (!nextSec) return;
        const firstTask = nextSec.tasks[0];
        setSelectedTaskId(firstTask ? firstTask.id : null);
      };

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveWithin(1);
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveWithin(-1);
        return;
      }
      if (e.key === 'h' || e.key === 'ArrowLeft') {
        e.preventDefault();
        moveSection(-1);
        return;
      }
      if (e.key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        moveSection(1);
        return;
      }
      if (e.key === ']') {
        // Hijack ]/[ on /team so the global view-cycle doesn't fire.
        e.preventDefault();
        e.stopPropagation();
        moveSection(1);
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        e.stopPropagation();
        moveSection(-1);
        return;
      }
      if (e.key === 'f') {
        e.preventDefault();
        ctx.onCycleScope();
        return;
      }

      const selected = section.tasks.find((t) => t.id === selectedTaskId);
      if (!selected) return;

      if (e.key === 'e') {
        e.preventDefault();
        openDrawer();
        return;
      }
      if (e.key === 'A') {
        e.preventDefault();
        openAssigneePicker({
          kind: 'task',
          taskId: selected.id,
          currentAssigneeId: selected.assigneeId,
        });
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [
    ctx,
    activeModal,
    assigneePickerOpen,
    involvedPickerOpen,
    openDrawer,
    selectedTaskId,
    setSelectedTaskId,
    openAssigneePicker,
  ]);
}
