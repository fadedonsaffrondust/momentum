import { useMemo, useRef, useState } from 'react';
import { useRoles, useSettings, useTasks } from '../api/hooks';
import { useUiStore } from '../store/ui';
import { TaskInputBar } from '../components/TaskInputBar';
import { RoleFilterBar } from '../components/RoleFilterBar';
import { TaskAssigneeFilter } from '../components/TaskAssigneeFilter';
import { TimeBudgetBar } from '../components/TimeBudgetBar';
import { KanbanColumn } from '../components/KanbanColumn';
import { useKeyboardController } from '../hooks/useKeyboardController';
import { todayIso } from '../lib/date';

export function TodayPage() {
  const settingsQ = useSettings();
  const rolesQ = useRoles();
  const assigneeFilter = useUiStore((s) => s.taskAssigneeFilter);
  // "Everyone" passes assigneeId=ALL to the backend for team-wide today
  // view. "Mine" relies on the backend's default current-user scoping.
  const tasksQ = useTasks({
    date: todayIso(),
    ...(assigneeFilter === 'everyone' ? { assigneeId: 'ALL' as const } : {}),
  });
  const roleFilter = useUiStore((s) => s.roleFilter);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawTasks = tasksQ.data ?? [];
  const tasks = useMemo(
    () => (roleFilter ? rawTasks.filter((t) => t.roleId === roleFilter) : rawTasks),
    [rawTasks, roleFilter],
  );

  const roles = rolesQ.data ?? [];

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
    editingTaskId,
    setEditingTaskId,
  });

  // Not auto-focused on mount — `/` (handled globally) focuses the input.

  const capacity = settingsQ.data?.dailyCapacityMinutes ?? 480;

  return (
    <div className="h-full flex flex-col gap-4 px-6 py-5 overflow-hidden">
      <TaskInputBar ref={inputRef} />
      <div className="flex items-center justify-between gap-4">
        <RoleFilterBar />
        <TaskAssigneeFilter />
      </div>
      <TimeBudgetBar tasks={tasks} capacityMinutes={capacity} />

      <div className="flex-1 min-h-0 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <KanbanColumn
          column="up_next"
          title="Up Next"
          tasks={columns.up_next}
          roles={roles}
          editingTaskId={editingTaskId}
          setEditingTaskId={setEditingTaskId}
        />
        <KanbanColumn
          column="in_progress"
          title="In Progress"
          tasks={columns.in_progress}
          roles={roles}
          editingTaskId={editingTaskId}
          setEditingTaskId={setEditingTaskId}
        />
        <KanbanColumn
          column="done"
          title="Done"
          tasks={columns.done}
          roles={roles}
          editingTaskId={editingTaskId}
          setEditingTaskId={setEditingTaskId}
        />
      </div>
    </div>
  );
}
