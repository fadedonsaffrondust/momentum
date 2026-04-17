import { Modal } from '../components/Modal';
import { useUiStore } from '../store/ui';
import { useRoles, useWeeklyStats } from '../api/hooks';

export function WeeklyStatsModal() {
  const close = useUiStore((s) => s.closeModal);
  const statsQ = useWeeklyStats();
  const rolesQ = useRoles();

  if (!statsQ.data) {
    return (
      <Modal title="Weekly Stats" onClose={close}>
        <p className="text-sm text-m-fg-muted">Loading…</p>
      </Modal>
    );
  }

  const stats = statsQ.data;
  const maxCompleted = Math.max(1, ...stats.days.map((d) => d.tasksCompleted));
  const mostActiveRole = rolesQ.data?.find((r) => r.id === stats.mostActiveRoleId);

  return (
    <Modal title="Weekly Stats" onClose={close} className="max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-end gap-2 h-32">
          {stats.days.map((d) => {
            const h = (d.tasksCompleted / maxCompleted) * 100;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-accent/70 rounded-t"
                    style={{ height: `${Math.max(4, h)}%` }}
                    title={`${d.tasksCompleted}/${d.tasksPlanned}`}
                  />
                </div>
                <div className="text-[10px] text-m-fg-dim">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Stat
            label="Avg completion"
            value={`${Math.round(stats.averageCompletionRate * 100)}%`}
          />
          <Stat label="Streak" value={`${stats.streak}d`} />
          <Stat
            label="Est. accuracy"
            value={stats.estimationAccuracy != null ? `${stats.estimationAccuracy.toFixed(2)}×` : '—'}
          />
          <Stat label="Top role" value={mostActiveRole?.name ?? '—'} />
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-m-border rounded-lg py-3">
      <div className="text-lg font-semibold text-m-fg">{value}</div>
      <div className="text-xs text-m-fg-muted mt-1">{label}</div>
    </div>
  );
}
