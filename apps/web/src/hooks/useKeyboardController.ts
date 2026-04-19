import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { Task, TaskColumn, Priority, Parking } from '@momentum/shared';
import { useUiStore } from '../store/ui';
import {
  useCompleteTask,
  useCreateTask,
  useDeferTask,
  useDeleteTask,
  useStartTask,
  useUpdateTask,
  useDiscussParking,
  useDeleteParking,
  useUpdateParking,
  useCreateParking,
} from '../api/hooks';

const PRIORITY_CYCLE: readonly Priority[] = ['low', 'medium', 'high'] as const;
const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

interface KeyboardContext {
  tasks: Task[];
  /** Inline-edit state for parkings. Task edits use the detail drawer via `e`. */
  editingTaskId?: string | null;
  setEditingTaskId?: (id: string | null) => void;
  /** Flat list of parkings in rendered order (used on /parkings). */
  parkings?: Parking[];
  /** Invoked when Enter is pressed on a parking — toggles the details drawer. */
  onParkingToggleExpand?: (id: string) => void;
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
 * Page-scoped keyboard handler for task and parking navigation + actions.
 * Global shortcuts (/, Escape, ?, Cmd+K/P/R/W/E/I, g-prefix, [, ], 0-9)
 * live in `useGlobalShortcuts` and are registered once in `AppShell` —
 * do NOT handle them here.
 */
export function useKeyboardController(ctx: KeyboardContext) {
  const location = useLocation();
  const activeModal = useUiStore((s) => s.activeModal);
  const openModal = useUiStore((s) => s.openModal);
  const openAssigneePicker = useUiStore((s) => s.openAssigneePicker);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const assigneePickerOpen = useUiStore((s) => s.assigneePickerTarget !== null);
  const openInvolvedPicker = useUiStore((s) => s.openInvolvedPicker);
  const involvedPickerOpen = useUiStore((s) => s.involvedPickerTarget !== null);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const focusedColumn = useUiStore((s) => s.focusedColumn);
  const setFocusedColumn = useUiStore((s) => s.setFocusedColumn);
  const pushToast = useUiStore((s) => s.pushToast);
  const selectedParkingId = useUiStore((s) => s.selectedParkingId);
  const setSelectedParkingId = useUiStore((s) => s.setSelectedParkingId);

  const startTask = useStartTask();
  const completeTask = useCompleteTask();
  const deferTask = useDeferTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const discussParking = useDiscussParking();
  const deleteParking = useDeleteParking();
  const updateParking = useUpdateParking();
  const createParking = useCreateParking();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Already consumed by `useGlobalShortcuts` during capture phase —
      // or by a modal that handles its own keys. Bail out cleanly.
      if (e.defaultPrevented) return;

      const typing = isTypingInInput();
      if (typing || activeModal || assigneePickerOpen || involvedPickerOpen) return;

      // Parkings view has its own simpler flat navigation + action set.
      if (location.pathname === '/parkings') {
        const parkings = ctx.parkings ?? [];
        if (parkings.length === 0) return;

        const currentParkingIdx = parkings.findIndex((p) => p.id === selectedParkingId);

        const moveParking = (delta: number) => {
          const base =
            currentParkingIdx < 0 ? (delta > 0 ? -1 : parkings.length) : currentParkingIdx;
          const next = Math.max(0, Math.min(parkings.length - 1, base + delta));
          const nextP = parkings[next];
          if (nextP) setSelectedParkingId(nextP.id);
        };

        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          moveParking(1);
          return;
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          moveParking(-1);
          return;
        }

        const selectedP = parkings.find((p) => p.id === selectedParkingId);
        if (!selectedP) return;

        if (e.key === 'Enter') {
          e.preventDefault();
          ctx.onParkingToggleExpand?.(selectedP.id);
          return;
        }
        if (e.key === ' ') {
          e.preventDefault();
          if (selectedP.status !== 'discussed') {
            discussParking.mutate(selectedP.id);
          }
          return;
        }
        if (e.key === 'e') {
          e.preventDefault();
          ctx.setEditingTaskId?.(selectedP.id);
          return;
        }
        if (e.key === 'r') {
          e.preventDefault();
          openModal('role-picker');
          return;
        }
        if (e.key === 'p') {
          e.preventDefault();
          const currentIdx = PRIORITY_CYCLE.indexOf(selectedP.priority);
          const next = PRIORITY_CYCLE[(currentIdx + 1) % PRIORITY_CYCLE.length] ?? 'medium';
          updateParking.mutate(
            { id: selectedP.id, priority: next },
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
        if (e.key === 'd') {
          e.preventDefault();
          const base = selectedP.targetDate
            ? new Date(selectedP.targetDate + 'T00:00:00')
            : new Date();
          base.setDate(base.getDate() + 1);
          const nextDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
          updateParking.mutate(
            { id: selectedP.id, targetDate: nextDate },
            {
              onSuccess: () => {
                pushToast({
                  kind: 'info',
                  message: `Deferred to ${nextDate}`,
                  durationMs: 2000,
                });
              },
            },
          );
          return;
        }
        if (e.key === 'v') {
          // Toggle visibility. Backend restricts PATCH on private parkings
          // to the creator; if another user tries this they get 404 and
          // we surface a toast. The optimistic path avoids a round-trip.
          e.preventDefault();
          const nextVisibility = selectedP.visibility === 'private' ? 'team' : 'private';
          updateParking.mutate(
            { id: selectedP.id, visibility: nextVisibility },
            {
              onSuccess: () => {
                pushToast({
                  kind: 'info',
                  message: `Visibility → ${nextVisibility === 'private' ? 'Private' : 'Team'}`,
                  durationMs: 2000,
                });
              },
              onError: (err) => {
                pushToast({
                  kind: 'error',
                  message:
                    err instanceof Error ? err.message : 'Failed to change visibility',
                  durationMs: 4000,
                });
              },
            },
          );
          return;
        }
        if (e.key === 'I') {
          // Shift+I opens the involved-users picker. Lowercase i stays
          // free for future use and avoids firing while typing.
          e.preventDefault();
          openInvolvedPicker({
            parkingId: selectedP.id,
            initialIds: selectedP.involvedIds,
            creatorId: selectedP.creatorId,
          });
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const snapshot = selectedP;
          deleteParking.mutate(selectedP.id, {
            onSuccess: () => {
              pushToast({
                kind: 'info',
                message: `Deleted "${snapshot.title}"`,
                actionLabel: 'Undo',
                durationMs: 5000,
                onAction: () => {
                  createParking.mutate({
                    title: snapshot.title,
                    notes: snapshot.notes,
                    outcome: snapshot.outcome,
                    roleId: snapshot.roleId,
                    priority: snapshot.priority,
                    targetDate: snapshot.targetDate,
                  });
                },
              });
            },
          });
          return;
        }
        return;
      }

      // Today view only past this point.
      if (location.pathname !== '/') return;

      const columns: TaskColumn[] = ['up_next', 'in_progress', 'done'];
      const byCol: Record<TaskColumn, Task[]> = {
        up_next: ctx.tasks.filter((t) => t.column === 'up_next'),
        in_progress: ctx.tasks.filter((t) => t.column === 'in_progress'),
        done: ctx.tasks.filter((t) => t.column === 'done'),
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

      const selected = ctx.tasks.find((t) => t.id === selectedTaskId);
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
    ctx,
    activeModal,
    assigneePickerOpen,
    involvedPickerOpen,
    openDrawer,
    focusedColumn,
    selectedTaskId,
    location.pathname,
    openModal,
    openAssigneePicker,
    openInvolvedPicker,
    setSelectedTaskId,
    setFocusedColumn,
    startTask,
    completeTask,
    deferTask,
    deleteTask,
    createTask,
    updateTask,
    discussParking,
    deleteParking,
    updateParking,
    createParking,
    selectedParkingId,
    setSelectedParkingId,
    pushToast,
  ]);
}
