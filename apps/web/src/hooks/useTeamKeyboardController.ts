import { useEffect } from 'react';
import type { Task } from '@momentum/shared';
import { useUiStore } from '../store/ui';

type TaskColumnKind = 'up_next' | 'in_progress' | 'done';
const COLUMNS: readonly TaskColumnKind[] = ['up_next', 'in_progress', 'done'] as const;

interface Section {
  userId: string;
  tasks: Task[];
}

interface Context {
  sections: readonly Section[];
  collapsed: Set<string>;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;
  onToggleCollapsed: (userId: string) => void;
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
 * Team-view-scoped keyboard handler (spec §9.7). Active only on /team.
 *
 * j/k — next/prev task within the focused column
 * h/l — switch column within the focused section
 * ]/[ — next/prev section (hijacks the global view-cycle on /team)
 * f   — cycle date scope (today → week → all)
 * e   — inline-edit selected task title
 * A   — open assignee picker for selected task
 * Enter — open TaskDetailModal for selected task (spec §9.12)
 * Esc — clear selection or close modal (Esc on modals handled inside)
 *
 * The handler uses capture-phase so ]/[ can intercept before the global
 * handler's view-cycle fires. Falls through when a modal or picker is open.
 */
export function useTeamKeyboardController(ctx: Context) {
  const activeModal = useUiStore((s) => s.activeModal);
  const assigneePickerOpen = useUiStore((s) => s.assigneePickerTarget !== null);
  const involvedPickerOpen = useUiStore((s) => s.involvedPickerTarget !== null);
  const openAssigneePicker = useUiStore((s) => s.openAssigneePicker);

  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const focusedColumn = useUiStore((s) => s.focusedColumn);
  const setFocusedColumn = useUiStore((s) => s.setFocusedColumn);
  const selectedDetailTaskId = useUiStore((s) => s.selectedDetailTaskId);
  const setSelectedDetailTaskId = useUiStore((s) => s.setSelectedDetailTaskId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isTypingInInput()) return;
      if (activeModal || assigneePickerOpen || involvedPickerOpen || selectedDetailTaskId) return;
      if (ctx.sections.length === 0) return;

      // Determine the currently-focused section: either the section
      // containing the selected task, or fall back to the first.
      const focusedSectionIdx = (() => {
        if (!selectedTaskId) return 0;
        for (let i = 0; i < ctx.sections.length; i++) {
          if (ctx.sections[i]!.tasks.some((t) => t.id === selectedTaskId)) return i;
        }
        return 0;
      })();

      const section = ctx.sections[focusedSectionIdx]!;
      const columnTasks = section.tasks.filter((t) => t.column === focusedColumn);
      const currentIdx = columnTasks.findIndex((t) => t.id === selectedTaskId);

      const moveWithinColumn = (delta: number) => {
        if (columnTasks.length === 0) return;
        const base = currentIdx < 0 ? (delta > 0 ? -1 : columnTasks.length) : currentIdx;
        const next = Math.max(0, Math.min(columnTasks.length - 1, base + delta));
        const nextTask = columnTasks[next];
        if (nextTask) setSelectedTaskId(nextTask.id);
      };

      const moveColumn = (delta: number) => {
        const curIdx = COLUMNS.indexOf(focusedColumn);
        const nextIdx = Math.max(0, Math.min(COLUMNS.length - 1, curIdx + delta));
        const nextCol = COLUMNS[nextIdx]!;
        setFocusedColumn(nextCol);
        const firstInCol = section.tasks.find((t) => t.column === nextCol);
        setSelectedTaskId(firstInCol ? firstInCol.id : null);
      };

      const moveSection = (delta: number) => {
        const nextIdx = Math.max(
          0,
          Math.min(ctx.sections.length - 1, focusedSectionIdx + delta),
        );
        const nextSec = ctx.sections[nextIdx];
        if (!nextSec) return;
        const firstInCol = nextSec.tasks.find((t) => t.column === focusedColumn);
        setSelectedTaskId(firstInCol ? firstInCol.id : null);
      };

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveWithinColumn(1);
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveWithinColumn(-1);
        return;
      }
      if (e.key === 'h' || e.key === 'ArrowLeft') {
        e.preventDefault();
        moveColumn(-1);
        return;
      }
      if (e.key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        moveColumn(1);
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

      const selected = columnTasks.find((t) => t.id === selectedTaskId);
      if (!selected) return;

      if (e.key === 'e') {
        e.preventDefault();
        ctx.setEditingTaskId(selected.id);
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
      if (e.key === 'Enter') {
        e.preventDefault();
        setSelectedDetailTaskId(selected.id);
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
    selectedDetailTaskId,
    selectedTaskId,
    focusedColumn,
    setSelectedTaskId,
    setFocusedColumn,
    setSelectedDetailTaskId,
    openAssigneePicker,
  ]);
}
