import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { useUiStore } from '../store/ui';
import { useRoles, useTeamWeeklyStats, useWeeklyStats } from '../api/hooks';
import { Avatar } from '../components/Avatar';

type Tab = 'mine' | 'team';

export function WeeklyStatsModal() {
  const close = useUiStore((s) => s.closeModal);
  const [tab, setTab] = useState<Tab>('mine');

  // `[` / `]` switch tabs (spec §9.9). Handled here so the binding is
  // only live while the modal is open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement | null)?.isContentEditable) {
        return;
      }
      if (e.key === ']' || e.key === '[') {
        e.preventDefault();
        e.stopPropagation();
        setTab((t) => (t === 'mine' ? 'team' : 'mine'));
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <Modal title="Weekly Stats" onClose={close} className="max-w-2xl">
      <div className="flex items-center gap-1 mb-5 border-b border-border/60">
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          Mine
        </TabButton>
        <TabButton active={tab === 'team'} onClick={() => setTab('team')}>
          Team
        </TabButton>
        <span className="ml-auto text-[10px] text-muted-foreground/70 pb-2">
          <Kbd>[</Kbd> <Kbd>]</Kbd> switch tabs
        </span>
      </div>
      {tab === 'mine' ? <MinePanel /> : <TeamPanel />}
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'px-3 py-2 text-sm font-medium text-foreground border-b-2 border-primary -mb-px'
          : 'px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition'
      }
    >
      {children}
    </button>
  );
}

function MinePanel() {
  const statsQ = useWeeklyStats();
  const rolesQ = useRoles();

  if (!statsQ.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const stats = statsQ.data;
  const maxCompleted = Math.max(1, ...stats.days.map((d) => d.tasksCompleted));
  const mostActiveRole = rolesQ.data?.find((r) => r.id === stats.mostActiveRoleId);

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-2 h-32">
        {stats.days.map((d) => {
          const h = (d.tasksCompleted / maxCompleted) * 100;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full bg-primary/70 rounded-t"
                  style={{ height: `${Math.max(4, h)}%` }}
                  title={`${d.tasksCompleted}/${d.tasksPlanned}`}
                />
              </div>
              <div className="text-[10px] text-muted-foreground/70">
                {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, {
                  weekday: 'short',
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <Stat label="Avg completion" value={`${Math.round(stats.averageCompletionRate * 100)}%`} />
        <Stat label="Streak" value={`${stats.streak}d`} />
        <Stat
          label="Est. accuracy"
          value={stats.estimationAccuracy != null ? `${stats.estimationAccuracy.toFixed(2)}×` : '—'}
        />
        <Stat label="Top role" value={mostActiveRole?.name ?? '—'} />
      </div>
    </div>
  );
}

function TeamPanel() {
  const statsQ = useTeamWeeklyStats();
  const rolesQ = useRoles();

  if (!statsQ.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const rows = statsQ.data.users;
  const roles = rolesQ.data ?? [];

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No teammates yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium">Teammate</th>
            <th className="text-right px-3 py-2 font-medium">Completion</th>
            <th className="text-right px-3 py-2 font-medium">Est. accuracy</th>
            <th className="text-right px-3 py-2 font-medium">Streak</th>
            <th className="text-left px-3 py-2 font-medium">Top role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const role = r.mostActiveRoleId ? roles.find((x) => x.id === r.mostActiveRoleId) : null;
            return (
              <tr key={r.user.id} className="border-t border-border/60 hover:bg-card/60 transition">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar user={r.user} size="sm" showTooltip={false} />
                    <span className="truncate text-foreground">
                      {r.user.displayName || r.user.email}
                    </span>
                  </div>
                </td>
                <td className="text-right px-3 py-2 text-foreground tabular-nums">
                  {Math.round(r.completionRate * 100)}%
                </td>
                <td className="text-right px-3 py-2 text-foreground tabular-nums">
                  {r.estimationAccuracy != null ? `${r.estimationAccuracy.toFixed(2)}×` : '—'}
                </td>
                <td className="text-right px-3 py-2 text-foreground tabular-nums">{r.streak}d</td>
                <td className="px-3 py-2">
                  {role ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-2xs px-2 py-0.5 rounded-full border"
                      style={{
                        color: role.color,
                        borderColor: `${role.color}55`,
                        backgroundColor: `${role.color}12`,
                      }}
                    >
                      {role.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg py-3">
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded border border-border bg-card text-[9px] font-mono text-muted-foreground">
      {children}
    </kbd>
  );
}
