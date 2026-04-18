import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Task } from '@momentum/shared';
import { useMe, useRoles, useTeamTasks } from '../api/hooks';
import { useUiStore } from '../store/ui';
import { Avatar } from '../components/Avatar';
import { TaskCard } from '../components/TaskCard';
import { RoleFilterBar } from '../components/RoleFilterBar';
import { useTeamKeyboardController } from '../hooks/useTeamKeyboardController';
import { todayIso } from '../lib/date';

type DateScope = 'today' | 'week' | 'all';
type TaskColumnKind = 'up_next' | 'in_progress' | 'done';

const COLUMNS: readonly TaskColumnKind[] = ['up_next', 'in_progress', 'done'] as const;
const COLUMN_LABELS: Record<TaskColumnKind, string> = {
  up_next: 'Up Next',
  in_progress: 'In Progress',
  done: 'Done',
};

const SCOPE_LABELS: Record<DateScope, string> = {
  today: 'Today',
  week: 'This week',
  all: 'All scheduled',
};

/**
 * Team Task View (/team, spec §9.7). Ordered sections — current user
 * first, then alpha by displayName — each containing a three-column
 * mini-kanban. Keyboard nav is driven by `useTeamKeyboardController`.
 */
export function TeamPage() {
  const meQ = useMe();
  const rolesQ = useRoles();
  const [scope, setScope] = useState<DateScope>('today');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const roleFilter = useUiStore((s) => s.roleFilter);

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
      tasks: s.tasks.filter((t) => {
        if (roleFilter && t.roleId !== roleFilter) return false;
        if (scope === 'today') return true; // already filtered server-side
        if (scope === 'week') {
          if (!t.scheduledDate) return false;
          return t.scheduledDate >= today && t.scheduledDate <= weekOutIso;
        }
        return true; // all scheduled
      }),
    }));
  }, [tasksQ.data, scope, roleFilter]);

  const roles = rolesQ.data ?? [];
  const rolesById = new Map(roles.map((r) => [r.id, r]));

  useTeamKeyboardController({
    sections: sections.map((s) => ({ userId: s.user.id, tasks: s.tasks })),
    collapsed,
    editingTaskId,
    setEditingTaskId,
    onToggleCollapsed: (userId) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        return next;
      });
    },
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
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/60">
        <div className="flex items-center gap-4">
          <h1 className="text-lg text-primary">Team</h1>
          <RoleFilterBar />
        </div>
        <DateScopeChip value={scope} onChange={setScope} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {tasksQ.isLoading && (
          <p className="text-sm text-muted-foreground">Loading team…</p>
        )}
        {!tasksQ.isLoading && sections.length === 0 && (
          <p className="text-sm text-muted-foreground">No active teammates yet.</p>
        )}

        {sections.map((section) => {
          const isCollapsed = collapsed.has(section.user.id);
          const isMe = meQ.data?.id === section.user.id;
          return (
            <section key={section.user.id} data-team-section-user={section.user.id}>
              <SectionHeader
                section={section}
                isCollapsed={isCollapsed}
                isMe={isMe}
                onToggleCollapse={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(section.user.id)) next.delete(section.user.id);
                    else next.add(section.user.id);
                    return next;
                  })
                }
              />
              {!isCollapsed && (
                <div className="mt-3 grid gap-3 grid-cols-1 md:grid-cols-3">
                  {COLUMNS.map((col) => (
                    <TeamColumn
                      key={col}
                      column={col}
                      tasks={section.tasks.filter((t) => t.column === col)}
                      rolesById={rolesById}
                      editingTaskId={editingTaskId}
                      setEditingTaskId={setEditingTaskId}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({
  section,
  isCollapsed,
  isMe,
  onToggleCollapse,
}: {
  section: { user: { id: string; displayName: string; email: string; avatarColor: string; deactivatedAt: string | null }; tasks: Task[] };
  isCollapsed: boolean;
  isMe: boolean;
  onToggleCollapse: () => void;
}) {
  const stats = useMemo(() => {
    let upNext = 0;
    let inProgress = 0;
    let doneToday = 0;
    const today = todayIso();
    for (const t of section.tasks) {
      if (t.column === 'up_next') upNext++;
      else if (t.column === 'in_progress') inProgress++;
      else if (t.column === 'done' && t.scheduledDate === today) doneToday++;
    }
    return { upNext, inProgress, doneToday };
  }, [section.tasks]);

  return (
    <button
      type="button"
      onClick={onToggleCollapse}
      className="w-full flex items-center gap-3 text-left hover:bg-card/40 rounded-lg px-2 py-1.5 transition"
    >
      <Avatar user={section.user} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">
            {section.user.displayName || section.user.email}
          </span>
          {isMe && (
            <span className="text-[10px] uppercase tracking-widest text-primary">
              You
            </span>
          )}
        </div>
        <div className="text-2xs text-muted-foreground">
          {stats.inProgress} in progress · {stats.upNext} up next · {stats.doneToday} done today
        </div>
      </div>
      <span className="text-xs text-muted-foreground/70 shrink-0">{isCollapsed ? '▸' : '▾'}</span>
    </button>
  );
}

function TeamColumn({
  column,
  tasks,
  rolesById,
  editingTaskId,
  setEditingTaskId,
}: {
  column: TaskColumnKind;
  tasks: Task[];
  rolesById: Map<string, ReturnType<typeof useRoles>['data'] extends (infer U)[] | undefined ? U : never>;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;
}) {
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);

  return (
    <div className="bg-card/40 rounded-lg p-2 min-h-[80px] space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-1 flex items-center justify-between">
        <span>{COLUMN_LABELS[column]}</span>
        <span className="text-muted-foreground/70 font-mono">{tasks.length}</span>
      </div>
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          role={t.roleId ? rolesById.get(t.roleId) : undefined}
          selected={selectedTaskId === t.id}
          onSelect={() => setSelectedTaskId(t.id)}
          editing={editingTaskId === t.id}
          onEditDone={() => setEditingTaskId(null)}
        />
      ))}
    </div>
  );
}

function DateScopeChip({ value, onChange }: { value: DateScope; onChange: (v: DateScope) => void }) {
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
              'px-2.5 py-1 rounded-md transition font-medium',
              active
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {SCOPE_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}
