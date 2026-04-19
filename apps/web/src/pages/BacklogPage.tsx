import { useMemo } from 'react';
import clsx from 'clsx';
import type { Task } from '@momentum/shared';
import { useMe, useRoles, useTasks, useUpdateTask, useUsers } from '../api/hooks';
import { todayIso } from '../lib/date';
import { formatMinutes, formatDateShort } from '../lib/format';
import { useUiStore } from '../store/ui';
import { Avatar } from '../components/Avatar';
import { useBacklogKeyboardController } from '../hooks/useBacklogKeyboardController';

const GROUP_ORDER = ['Overdue', 'Tomorrow', 'This Week', 'Later', 'Someday'] as const;

export function BacklogPage() {
  const assigneeFilter = useUiStore((s) => s.taskAssigneeFilter);
  const tasksQ = useTasks(assigneeFilter === 'everyone' ? { assigneeId: 'ALL' as const } : {});
  const rolesQ = useRoles();
  const usersQ = useUsers();
  const meQ = useMe();
  const updateTask = useUpdateTask();
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const today = todayIso();

  const tasks = tasksQ.data ?? [];
  const roles = rolesQ.data ?? [];
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const usersById = new Map((usersQ.data ?? []).map((u) => [u.id, u]));
  const currentUserId = meQ.data?.id;

  const groups = useMemo(() => {
    const overdue: Task[] = [];
    const tomorrowBucket: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];
    const someday: Task[] = [];

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);
    const weekOut = new Date(now);
    weekOut.setDate(weekOut.getDate() + 7);

    for (const t of tasks) {
      if (t.status === 'done') continue;
      if (t.scheduledDate === today) continue;
      if (!t.scheduledDate) someday.push(t);
      else if (t.scheduledDate < today) overdue.push(t);
      else if (t.scheduledDate === tomorrowIso) tomorrowBucket.push(t);
      else if (new Date(t.scheduledDate) <= weekOut) thisWeek.push(t);
      else later.push(t);
    }
    return {
      Overdue: overdue,
      Tomorrow: tomorrowBucket,
      'This Week': thisWeek,
      Later: later,
      Someday: someday,
    } satisfies Record<string, Task[]>;
  }, [tasks, today]);

  // Flat ordered task list for j/k navigation — follows the render order
  // of GROUP_ORDER so keyboard motion matches what the user sees.
  const flatTasks = useMemo(() => GROUP_ORDER.flatMap((g) => groups[g]), [groups]);

  useBacklogKeyboardController({ tasks: flatTasks });

  const moveToToday = (id: string) =>
    updateTask.mutate({ id, scheduledDate: today, column: 'up_next' });

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="space-y-6 max-w-3xl">
        {GROUP_ORDER.map((label) => {
          const items = groups[label];
          if (!items || items.length === 0) return null;
          return (
            <section key={label}>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {label} · {items.length}
              </h2>
              <ul className="space-y-2">
                {items.map((t) => {
                  const role = t.roleId ? rolesById.get(t.roleId) : undefined;
                  const assignee =
                    currentUserId && t.assigneeId !== currentUserId
                      ? usersById.get(t.assigneeId)
                      : undefined;
                  const isSelected = selectedTaskId === t.id;
                  return (
                    <li
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      onDoubleClick={() => {
                        setSelectedTaskId(t.id);
                        openDrawer();
                      }}
                      className={clsx(
                        'flex items-center justify-between gap-3 rounded-lg border bg-card/40 px-3 py-2 text-sm cursor-pointer transition',
                        isSelected
                          ? 'border-border ring-2 ring-primary/80'
                          : 'border-border hover:border-border',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground truncate">{t.title}</span>
                          {assignee && <Avatar user={assignee} size="xs" className="shrink-0" />}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                          {role && <span style={{ color: role.color }}>{role.name}</span>}
                          {t.estimateMinutes != null && (
                            <span>{formatMinutes(t.estimateMinutes)}</span>
                          )}
                          {t.scheduledDate && <span>{formatDateShort(t.scheduledDate)}</span>}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToToday(t.id);
                        }}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        → Today
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {Object.values(groups).every((g) => g.length === 0) && (
          <div className="flex flex-col items-center gap-1 py-12 text-center">
            <p className="text-sm text-muted-foreground">Backlog is empty.</p>
            <p className="text-2xs text-muted-foreground/70">
              Press <kbd className="font-mono">/</kbd> or <kbd className="font-mono">n</kbd> to
              schedule something for later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
