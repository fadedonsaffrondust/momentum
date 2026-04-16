import { useMemo } from 'react';
import type { Task } from '@momentum/shared';
import { useRoles, useTasks, useUpdateTask } from '../api/hooks';
import { todayIso } from '../lib/date';
import { formatMinutes, formatDateShort } from '../lib/format';

export function BacklogPage() {
  const tasksQ = useTasks({});
  const rolesQ = useRoles();
  const updateTask = useUpdateTask();
  const today = todayIso();

  const tasks = tasksQ.data ?? [];
  const roles = rolesQ.data ?? [];
  const rolesById = new Map(roles.map((r) => [r.id, r]));

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

  const moveToToday = (id: string) =>
    updateTask.mutate({ id, scheduledDate: today, column: 'up_next' });

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <h1 className="text-xl text-accent mb-4">Backlog</h1>
      <div className="space-y-6 max-w-3xl">
        {(['Overdue', 'Tomorrow', 'This Week', 'Later', 'Someday'] as const).map((label) => {
          const items = groups[label];
          if (!items || items.length === 0) return null;
          return (
            <section key={label}>
              <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
                {label} · {items.length}
              </h2>
              <ul className="space-y-2">
                {items.map((t) => {
                  const role = t.roleId ? rolesById.get(t.roleId) : undefined;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="text-zinc-200 truncate">{t.title}</div>
                        <div className="text-xs text-zinc-500 flex gap-2 mt-1">
                          {role && (
                            <span style={{ color: role.color }}>{role.name}</span>
                          )}
                          {t.estimateMinutes != null && (
                            <span>{formatMinutes(t.estimateMinutes)}</span>
                          )}
                          {t.scheduledDate && <span>{formatDateShort(t.scheduledDate)}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => moveToToday(t.id)}
                        className="text-xs text-accent hover:underline shrink-0"
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
          <p className="text-zinc-500 text-sm">Backlog is empty. Plan your day.</p>
        )}
      </div>
    </div>
  );
}
