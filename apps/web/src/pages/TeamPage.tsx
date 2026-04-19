import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Task } from '@momentum/shared';
import { useMe, useRoles, useTeamTasks } from '../api/hooks';
import { useUiStore } from '../store/ui';
import { cn } from '@/lib/utils';
import { Avatar } from '../components/Avatar';
import { TaskCard } from '../components/TaskCard';
import { RoleFilterBar } from '../components/RoleFilterBar';
import { useTeamKeyboardController } from '../hooks/useTeamKeyboardController';
import { todayIso } from '../lib/date';

type DateScope = 'today' | 'week' | 'all';

const SCOPE_LABELS: Record<DateScope, string> = {
  today: 'Today',
  week: 'This week',
  all: 'All scheduled',
};

// Status sort order within a teammate's column: actionable on top,
// historical at the bottom.
const STATUS_ORDER: Record<Task['status'], number> = {
  in_progress: 0,
  todo: 1,
  done: 2,
};

/**
 * Team Task View (/team). One column per teammate (current user first,
 * then alpha by displayName). Each column contains a flat list of the
 * teammate's tasks sorted by status, with a status tag on each card.
 * Keyboard nav is driven by `useTeamKeyboardController`.
 */
export function TeamPage() {
  const meQ = useMe();
  const rolesQ = useRoles();
  const [scope, setScope] = useState<DateScope>('today');

  const roleFilter = useUiStore((s) => s.roleFilter);
  const drawerOpen = useUiStore((s) => s.drawerOpen);

  // Backend supports a single `date` query param. `week` + `all` both
  // skip the filter and let us trim client-side to the 7-day window.
  const tasksQ = useTeamTasks(scope === 'today' ? { date: todayIso() } : {});

  const sections = useMemo(() => {
    const raw = tasksQ.data?.sections ?? [];
    const today = todayIso();
    const weekOutIso = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })();

    return raw.map((s) => ({
      user: s.user,
      tasks: s.tasks
        .filter((t) => {
          if (roleFilter && t.roleId !== roleFilter) return false;
          if (scope === 'today') return true; // already filtered server-side
          if (scope === 'week') {
            if (!t.scheduledDate) return false;
            return t.scheduledDate >= today && t.scheduledDate <= weekOutIso;
          }
          return true; // all scheduled
        })
        .slice()
        .sort((a, b) => {
          const sa = STATUS_ORDER[a.status];
          const sb = STATUS_ORDER[b.status];
          if (sa !== sb) return sa - sb;
          return a.createdAt.localeCompare(b.createdAt);
        }),
    }));
  }, [tasksQ.data, scope, roleFilter]);

  const roles = rolesQ.data ?? [];
  const rolesById = new Map(roles.map((r) => [r.id, r]));

  useTeamKeyboardController({
    sections: sections.map((s) => ({ userId: s.user.id, tasks: s.tasks })),
    onCycleScope: () => {
      setScope((prev) => {
        if (prev === 'today') return 'week';
        if (prev === 'week') return 'all';
        return 'today';
      });
    },
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div
        className={cn(
          'px-6 pt-4 pb-3 border-b border-border/60 shrink-0 flex items-center justify-between gap-4',
          'transition-[padding] duration-150 ease-out',
          // Keep the page chrome in the visible area when the drawer is
          // open — the column board below is what scrolls under the drawer.
          drawerOpen && 'md:pr-[640px]',
        )}
      >
        <h1 className="text-xs uppercase tracking-widest text-muted-foreground/70 font-semibold">
          Team
        </h1>
        <DateScopeChip value={scope} onChange={setScope} />
      </div>

      <div
        className={cn(
          'px-6 pt-4 shrink-0',
          'transition-[padding] duration-150 ease-out',
          drawerOpen && 'md:pr-[640px]',
        )}
      >
        <RoleFilterBar />
      </div>

      {tasksQ.isLoading && <p className="text-sm text-muted-foreground px-6 py-4">Loading team…</p>}
      {!tasksQ.isLoading && sections.length === 0 && (
        <p className="text-sm text-muted-foreground px-6 py-4">No active teammates yet.</p>
      )}

      {!tasksQ.isLoading && sections.length > 0 && (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 h-full px-6 py-4 pb-2">
            {sections.map((section) => (
              <TeammateColumn
                key={section.user.id}
                user={section.user}
                tasks={section.tasks}
                isMe={meQ.data?.id === section.user.id}
                rolesById={rolesById}
                scope={scope}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeammateColumn({
  user,
  tasks,
  isMe,
  rolesById,
  scope,
}: {
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarColor: string;
    deactivatedAt: string | null;
  };
  tasks: Task[];
  isMe: boolean;
  rolesById: Map<
    string,
    ReturnType<typeof useRoles>['data'] extends (infer U)[] | undefined ? U : never
  >;
  scope: DateScope;
}) {
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);

  const stats = useMemo(() => {
    let upNext = 0;
    let inProgress = 0;
    let doneToday = 0;
    const today = todayIso();
    for (const t of tasks) {
      if (t.column === 'up_next') upNext++;
      else if (t.column === 'in_progress') inProgress++;
      else if (t.column === 'done' && t.scheduledDate === today) doneToday++;
    }
    return { upNext, inProgress, doneToday };
  }, [tasks]);

  return (
    <section
      data-team-section-user={user.id}
      className={clsx(
        'w-[320px] shrink-0 flex flex-col max-h-full rounded-xl border bg-background/40',
        isMe ? 'border-border' : 'border-border/60',
      )}
    >
      <header className="px-3 py-3 border-b border-border/60 flex items-center gap-2 shrink-0">
        <Avatar user={user} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {user.displayName || user.email}
            </span>
            {isMe && (
              <span className="text-[10px] uppercase tracking-widest text-primary">You</span>
            )}
          </div>
          <div className="text-2xs text-muted-foreground">
            {stats.inProgress} in progress · {stats.upNext} up next · {stats.doneToday} done today
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground/70 text-center py-8">
            {scope === 'today' ? 'Nothing scheduled for today.' : 'No tasks in this scope.'}
          </p>
        )}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            role={t.roleId ? rolesById.get(t.roleId) : undefined}
            selected={selectedTaskId === t.id}
            onSelect={() => setSelectedTaskId(t.id)}
            showStatus
          />
        ))}
      </div>
    </section>
  );
}

function DateScopeChip({
  value,
  onChange,
}: {
  value: DateScope;
  onChange: (v: DateScope) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Date scope"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/40 p-0.5 text-xs"
    >
      {(['today', 'week', 'all'] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={clsx(
              'px-2.5 py-1 rounded-md transition-colors duration-150 font-medium',
              active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {SCOPE_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}
