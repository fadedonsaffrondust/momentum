import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { useUiStore } from '../store/ui';
import { useDeferTask, useDeleteTask, useTasks, useUpsertDailyLog } from '../api/hooks';
import { todayIso } from '../lib/date';
import { formatMinutes } from '../lib/format';
import { TeamPulseStrip } from '../components/TeamPulseStrip';

export function EndOfDayModal() {
  const close = useUiStore((s) => s.closeModal);
  const [journal, setJournal] = useState('');
  const saveLog = useUpsertDailyLog();
  const deferTask = useDeferTask();
  const deleteTask = useDeleteTask();

  const today = todayIso();
  const tasksQ = useTasks({ date: today });
  const tasks = tasksQ.data ?? [];

  const { done, incomplete, estimated, actual, rate } = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done');
    const incomplete = tasks.filter((t) => t.status !== 'done');
    const estimated = tasks.reduce((s, t) => s + (t.estimateMinutes ?? 0), 0);
    const actual = done.reduce((s, t) => s + (t.actualMinutes ?? 0), 0);
    const rate = tasks.length > 0 ? done.length / tasks.length : 0;
    return { done, incomplete, estimated, actual, rate };
  }, [tasks]);

  const accuracy =
    actual > 0 && estimated > 0 ? Math.round((estimated / actual) * 100) / 100 : null;

  const save = async () => {
    await saveLog.mutateAsync({ date: today, journalEntry: journal.trim() || null });
    close();
  };

  return (
    <Modal title="End of Day Review" onClose={close} className="max-w-3xl">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Completed" value={`${done.length}/${tasks.length}`} />
          <Stat label="Completion" value={`${Math.round(rate * 100)}%`} />
          <Stat label="Est. accuracy" value={accuracy != null ? `${accuracy}×` : '—'} />
        </div>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-m-fg-muted mb-2">Done</h3>
          <ul className="space-y-1 text-sm">
            {done.map((t) => (
              <li key={t.id} className="flex justify-between">
                <span className="text-m-fg-secondary line-through">{t.title}</span>
                <span className="text-xs text-m-fg-dim">
                  {formatMinutes(t.actualMinutes)} / {formatMinutes(t.estimateMinutes)}
                </span>
              </li>
            ))}
            {done.length === 0 && <li className="text-xs text-m-fg-dim">Nothing done.</li>}
          </ul>
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-m-fg-muted mb-2">Incomplete</h3>
          <ul className="space-y-1 text-sm">
            {incomplete.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <span className="text-m-fg-secondary">{t.title}</span>
                <div className="flex gap-2 text-xs">
                  <button
                    className="text-accent hover:underline"
                    onClick={() => deferTask.mutate(t.id)}
                  >
                    Defer
                  </button>
                  <button
                    className="text-red-400 hover:text-red-300"
                    onClick={() => deleteTask.mutate(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {incomplete.length === 0 && (
              <li className="text-xs text-m-fg-dim">Clean slate for tomorrow.</li>
            )}
          </ul>
        </section>

        <label className="block">
          <span className="text-xs text-m-fg-muted">One thing you learned today?</span>
          <textarea
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            rows={3}
            className="mt-1 w-full bg-m-bg border border-m-border rounded px-3 py-2 text-sm text-m-fg focus:outline-none focus:border-accent resize-none"
            placeholder="Write a sentence…"
          />
        </label>

        <div className="flex gap-2">
          <button
            onClick={close}
            className="flex-1 py-2 rounded-md border border-m-border text-sm hover:bg-m-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saveLog.isPending}
            className="flex-1 py-2 rounded-md bg-accent hover:bg-accent-hover text-sm disabled:opacity-50"
          >
            Save review
          </button>
        </div>

        {/* Muted team-pulse strip (spec §9.9). Sits below the journal +
            save buttons so it doesn't compete with the personal recap. */}
        <TeamPulseStrip />
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-m-border rounded-lg py-3">
      <div className="text-2xl font-semibold text-m-fg">{value}</div>
      <div className="text-xs text-m-fg-muted mt-1">{label}</div>
    </div>
  );
}
