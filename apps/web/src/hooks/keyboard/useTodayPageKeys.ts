import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { Priority, Task, TaskColumn } from '@momentum/shared';
import {
  useCompleteTask,
  useCreateTask,
  useDeferTask,
  useDeleteTask,
  useStartTask,
  useUpdateTask,
} from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { shouldBailOnEvent, useKeyboardBailFlags } from './_shared';

const PRIORITY_CYCLE: readonly Priority[] = ['low', 'medium', 'high'] as const;
const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/**
 * Today-view (`/`) keyboard shortcuts:
 *   j / k / ↓ / ↑   — move selection within current column
 *   h / l / ← / →   — move focus across columns
 *   Enter           — start (todo) or complete (in-progress)
 *   Space           — complete (unless already done)
 *   e               — open detail drawer
 *   d               — defer
 *   r               — open role picker
 *   A (Shift+A)     — open assignee picker
 *   p               — cycle priority (low → med → high → low)
 *   Delete / Backsp — delete (with undo toast)
 *
 * Bindings ported VERBATIM from the original useKeyboardController so a
 * future cross-check against ShortcutsModal still passes — see CLAUDE.md
 * "Keep the shortcuts help in sync".
 */
export function useTodayPageKeys(tasks: Task[]) {
  const location = useLocation();
  const flags = useKeyboardBailFlags();
  const openModal = useUiStore((s) => s.openModal);
  const openAssigneePicker = useUiStore((s) => s.openAssigneePicker);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const focusedColumn = useUiStore((s) => s.focusedColumn);
  const setFocusedColumn = useUiStore((s) => s.setFocusedColumn);
  const pushToast = useUiStore((s) => s.pushToast);

  const startTask = useStartTask();
  const completeTask = useCompleteTask();
  const deferTask = useDeferTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (shouldBailOnEvent(e, flags)) return;
      if (location.pathname !== '/') return;

      const columns: TaskColumn[] = ['up_next', 'in_progress', 'done'];
      const byCol: Record<TaskColumn, Task[]> = {
        up_next: tasks.filter((t) => t.column === 'up_next'),
        in_progress: tasks.filter((t) => t.column === 'in_progress'),
        done: tasks.filter((t) => t.column === 'done'),
      };
      const activeTasks = byCol[focusedColumn];
      const currentIdx = activeTasks.findIndex((t) => t.id === selectedTaskId);

      const moveWithin = (delta: number) => {
        if (activeTasks.length === 0) return;
        const base = currentIdx < 0 ? (delta > 0 ? -1 : activeTasks.length) : currentIdx;
        const next = Math.max(0, Math.min(activeTasks.length - 1, base + delta));
        const nextTask = activeTasks[next];
        if (nextTask) setSelectedTaskId(nextTask.id);
      };

      const moveColumn = (delta: number) => {
        const currentColIdx = columns.indexOf(focusedColumn);
        const nextColIdx = Math.max(0, Math.min(columns.length - 1, currentColIdx + delta));
        const nextCol = columns[nextColIdx]!;
        setFocusedColumn(nextCol);
        const next = byCol[nextCol][0];
        setSelectedTaskId(next ? next.id : null);
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
        moveColumn(-1);
        return;
      }
      if (e.key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        moveColumn(1);
        return;
      }

      const selected = tasks.find((t) => t.id === selectedTaskId);
      if (!selected) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (selected.status === 'todo') {
          startTask.mutate(selected.id, {
            onError: (err) => {
              pushToast({
                kind: 'error',
                message: err instanceof Error ? err.message : 'Failed to start task',
                durationMs: 4000,
              });
            },
          });
        } else if (selected.status === 'in_progress') {
          completeTask.mutate(selected.id);
        }
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (selected.status !== 'done') {
          completeTask.mutate(selected.id);
        }
        return;
      }
      if (e.key === 'e') {
        e.preventDefault();
        openDrawer();
        return;
      }
      if (e.key === 'd') {
        e.preventDefault();
        deferTask.mutate(selected.id);
        return;
      }
      if (e.key === 'r') {
        e.preventDefault();
        openModal('role-picker');
        return;
      }
      if (e.key === 'A') {
        // Shift+A opens the assignee picker. Uppercase intentionally so
        // lowercase 'a' stays reserved for brand-detail "new action item"
        // and we don't fire while the user is typing elsewhere.
        e.preventDefault();
        openAssigneePicker({
          kind: 'task',
          taskId: selected.id,
          currentAssigneeId: selected.assigneeId,
        });
        return;
      }
      if (e.key === 'p') {
        e.preventDefault();
        const currentIdx = PRIORITY_CYCLE.indexOf(selected.priority);
        const next = PRIORITY_CYCLE[(currentIdx + 1) % PRIORITY_CYCLE.length] ?? 'medium';
        updateTask.mutate(
          { id: selected.id, priority: next },
          {
            onSuccess: () => {
              pushToast({
                kind: 'info',
                message: `Priority → ${PRIORITY_LABEL[next]}`,
                durationMs: 2000,
              });
            },
            onError: (err) => {
              pushToast({
                kind: 'error',
                message: err instanceof Error ? err.message : 'Failed to update priority',
                durationMs: 4000,
              });
            },
          },
        );
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const snapshot = selected;
        deleteTask.mutate(selected.id, {
          onSuccess: () => {
            pushToast({
              kind: 'info',
              message: `Deleted "${snapshot.title}"`,
              actionLabel: 'Undo',
              durationMs: 5000,
              onAction: () => {
                createTask.mutate({
                  title: snapshot.title,
                  roleId: snapshot.roleId,
                  priority: snapshot.priority,
                  estimateMinutes: snapshot.estimateMinutes,
                  scheduledDate: snapshot.scheduledDate,
                });
              },
            });
          },
        });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    tasks,
    flags,
    location.pathname,
    openModal,
    openAssigneePicker,
    openDrawer,
    focusedColumn,
    selectedTaskId,
    setSelectedTaskId,
    setFocusedColumn,
    pushToast,
    startTask,
    completeTask,
    deferTask,
    deleteTask,
    createTask,
    updateTask,
  ]);
}
