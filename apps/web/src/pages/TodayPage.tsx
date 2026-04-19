import { useMemo, useRef, useState } from 'react';
import { Plus, UserSquare } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import type { Task, TaskColumn } from '@momentum/shared';
import {
  useCompleteTask,
  usePauseTask,
  useReopenTask,
  useRoles,
  useSettings,
  useStartTask,
  useTasks,
} from '../api/hooks';
import { useUiStore } from '../store/ui';
import { TaskInputBar } from '../components/TaskInputBar';
import { RoleFilterBar } from '../components/RoleFilterBar';
import { TimeBudgetBar } from '../components/TimeBudgetBar';
import { KanbanColumn } from '../components/KanbanColumn';
import { TaskCard } from '../components/TaskCard';
import { useKeyboardController } from '../hooks/useKeyboardController';
import { todayIso } from '../lib/date';
import { useRegisterCommands } from '@/lib/commands/context';

export function TodayPage() {
  const settingsQ = useSettings();
  const rolesQ = useRoles();
  const assigneeFilter = useUiStore((s) => s.taskAssigneeFilter);
  const setAssigneeFilter = useUiStore((s) => s.setTaskAssigneeFilter);
  // "Everyone" passes assigneeId=ALL to the backend for team-wide today
  // view. "Mine" relies on the backend's default current-user scoping.
  const tasksQ = useTasks({
    date: todayIso(),
    ...(assigneeFilter === 'everyone' ? { assigneeId: 'ALL' as const } : {}),
  });
  const roleFilter = useUiStore((s) => s.roleFilter);
  const pushToast = useUiStore((s) => s.pushToast);
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawTasks = tasksQ.data ?? [];
  const tasks = useMemo(
    () => (roleFilter ? rawTasks.filter((t) => t.roleId === roleFilter) : rawTasks),
    [rawTasks, roleFilter],
  );

  const roles = rolesQ.data ?? [];
  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const columns = useMemo(
    () => ({
      up_next: tasks.filter((t) => t.column === 'up_next'),
      in_progress: tasks.filter((t) => t.column === 'in_progress'),
      done: tasks.filter((t) => t.column === 'done'),
    }),
    [tasks],
  );

  useKeyboardController({
    tasks,
  });

  // DnD wiring — pointer sensor with a small activation distance so a plain
  // click still fires `onSelect` without starting a drag. 6px matches the
  // threshold most kanban UIs use.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : undefined;

  const startTask = useStartTask();
  const completeTask = useCompleteTask();
  const pauseTask = usePauseTask();
  const reopenTask = useReopenTask();

  // Fade the overlay out on drop instead of letting dnd-kit animate it
  // back toward the source with a bouncy spring (the default). Matches
  // the app-wide ≤150ms / no-overshoot motion rule.
  const dropAnimation: DropAnimation = {
    duration: 150,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0' } },
    }),
  };

  const setBodyDragging = (dragging: boolean) => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('dnd-dragging', dragging);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setBodyDragging(true);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    setBodyDragging(false);
    if (!e.over) return;
    const task = tasks.find((t) => t.id === String(e.active.id));
    if (!task) return;
    const target = String(e.over.id) as TaskColumn;
    if (task.column === target) return;

    const onError = (err: unknown) => {
      pushToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to move task',
        durationMs: 4000,
      });
    };

    // Dispatch by destination column. Dedicated action endpoints handle the
    // side effects (startedAt / completedAt / actualMinutes / in-progress cap);
    // /reopen clears completedAt+startedAt so a subsequent /start begins fresh.
    if (target === 'in_progress') {
      if (task.column === 'done') {
        reopenTask.mutate(task.id, {
          onSuccess: () => startTask.mutate(task.id, { onError }),
          onError,
        });
      } else {
        startTask.mutate(task.id, { onError });
      }
      return;
    }
    if (target === 'done') {
      completeTask.mutate(task.id, { onError });
      return;
    }
    // target === 'up_next'
    if (task.column === 'in_progress') {
      pauseTask.mutate(task.id, { onError });
    } else if (task.column === 'done') {
      reopenTask.mutate(task.id, { onError });
    }
  };

  // Context commands registered for /today and /backlog.
  const todayCommands = useMemo(
    () => [
      {
        id: 'today:new-task',
        label: 'New task',
        description: 'Focus the Today task input',
        icon: Plus,
        shortcut: 'n',
        section: 'Today',
        priority: 100,
        when: (p: string) => p === '/' || p === '/backlog',
        run: () => {
          const target = document.querySelector<HTMLInputElement>('[data-task-input="true"]');
          target?.focus();
        },
      },
      {
        id: 'today:toggle-assignee',
        label: assigneeFilter === 'mine' ? "Show everyone's tasks" : 'Show only my tasks',
        description: 'Flip the Mine / Everyone filter',
        icon: UserSquare,
        section: 'Today',
        priority: 80,
        when: (p: string) => p === '/' || p === '/backlog',
        run: () => setAssigneeFilter(assigneeFilter === 'mine' ? 'everyone' : 'mine'),
      },
    ],
    [assigneeFilter, setAssigneeFilter],
  );
  useRegisterCommands(todayCommands, [todayCommands]);

  // Not auto-focused on mount — `/` (handled globally) focuses the input.

  const capacity = settingsQ.data?.dailyCapacityMinutes ?? 480;

  return (
    <div className="h-full flex flex-col gap-4 px-6 py-5 overflow-hidden">
      <TaskInputBar ref={inputRef} />
      <RoleFilterBar />
      <TimeBudgetBar tasks={tasks} capacityMinutes={capacity} />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setBodyDragging(false);
        }}
      >
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
          {/* Each column slot is a motion.div with `layout` so when the
              drawer opens and Done collapses (via AnimatePresence below),
              the remaining two columns glide to their new widths in sync
              with the padding transition on main — no pop. */}
          <motion.div
            layout
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex-1 min-w-0 flex"
          >
            <KanbanColumn
              column="up_next"
              title="Up Next"
              tasks={columns.up_next}
              roles={roles}
              dnd
            />
          </motion.div>
          <motion.div
            layout
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex-1 min-w-0 flex"
          >
            <KanbanColumn
              column="in_progress"
              title="In Progress"
              tasks={columns.in_progress}
              roles={roles}
              dnd
            />
          </motion.div>
          <AnimatePresence initial={false}>
            {!drawerOpen && (
              <motion.div
                key="done-col"
                layout
                initial={{ opacity: 0, flexGrow: 0 }}
                animate={{ opacity: 1, flexGrow: 1 }}
                exit={{ opacity: 0, flexGrow: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{ flexBasis: 0 }}
                className="min-w-0 flex overflow-hidden"
              >
                <KanbanColumn column="done" title="Done" tasks={columns.done} roles={roles} dnd />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              role={activeTask.roleId ? rolesById.get(activeTask.roleId) : undefined}
              selected={false}
              onSelect={() => undefined}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
