import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { useUiStore } from '../store/ui';
import {
  useDeferTask,
  useDeleteTask,
  useSettings,
  useTasks,
  useUpdateTask,
} from '../api/hooks';
import { todayIso, tomorrowIso } from '../lib/date';
import { formatMinutes } from '../lib/format';

export function PlanMyDayModal() {
  const close = useUiStore((s) => s.closeModal);
  const [step, setStep] = useState(0);

  const today = todayIso();
  const leftoversQ = useTasks({});
  const settingsQ = useSettings();
  const updateTask = useUpdateTask();
  const deferTask = useDeferTask();
  const deleteTask = useDeleteTask();

  const allTasks = leftoversQ.data ?? [];
  const leftovers = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.scheduledDate !== null &&
          t.scheduledDate < today &&
          t.status !== 'done',
      ),
    [allTasks, today],
  );
  const backlogSuggestions = useMemo(
    () =>
      allTasks
        .filter((t) => t.status === 'todo' && (!t.scheduledDate || t.scheduledDate > today))
        .sort((a, b) => {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
          if (order[a.priority] !== order[b.priority]) {
            return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
          }
          return a.createdAt.localeCompare(b.createdAt);
        })
        .slice(0, 5),
    [allTasks, today],
  );
  const todayTasks = useMemo(
    () => allTasks.filter((t) => t.scheduledDate === today && t.status !== 'done'),
    [allTasks, today],
  );

  const moveToToday = (id: string) =>
    updateTask.mutate({ id, scheduledDate: today, column: 'up_next' });

  const totalMinutes = todayTasks.reduce((s, t) => s + (t.estimateMinutes ?? 0), 0);
  const capacity = settingsQ.data?.dailyCapacityMinutes ?? 480;
  const message =
    totalMinutes > capacity
      ? "This is more than a day's work. What can move?"
      : totalMinutes >= capacity * 0.8
        ? 'Full day. Protect your focus.'
        : 'Solid plan. You have room to breathe.';

  return (
    <Modal title="Plan My Day" onClose={close} className="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {['Leftovers', 'Backlog', 'Summary'].map((label, i) => (
            <div
              key={label}
              className={`flex-1 px-3 py-1 rounded border ${
                i === step
                  ? 'border-primary text-primary'
                  : i < step
                    ? 'border-border text-muted-foreground'
                    : 'border-border/60 text-muted-foreground/70'
              }`}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <section className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Yesterday's leftovers — {leftovers.length} incomplete.
            </p>
            {leftovers.length === 0 && (
              <p className="text-xs text-muted-foreground/70">Nothing left behind. Nice.</p>
            )}
            {leftovers.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
              >
                <span className="text-foreground">{t.title}</span>
                <div className="flex gap-2">
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => moveToToday(t.id)}
                  >
                    Move to today
                  </button>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      deferTask.mutate(t.id)
                    }
                  >
                    Defer
                  </button>
                  <button
                    className="text-xs text-red-400 hover:text-red-300"
                    onClick={() => deleteTask.mutate(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {step === 1 && (
          <section className="space-y-2">
            <p className="text-sm text-muted-foreground">Top {backlogSuggestions.length} from backlog</p>
            {backlogSuggestions.length === 0 && (
              <p className="text-xs text-muted-foreground/70">Backlog is clean.</p>
            )}
            {backlogSuggestions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
              >
                <div>
                  <div className="text-foreground">{t.title}</div>
                  <div className="text-xs text-muted-foreground/70">
                    {t.priority} · {formatMinutes(t.estimateMinutes)}
                  </div>
                </div>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => moveToToday(t.id)}
                >
                  Pull to today
                </button>
              </div>
            ))}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {todayTasks.length} tasks planned · {formatMinutes(totalMinutes)} /{' '}
              {formatMinutes(capacity)}
            </p>
            <p className="text-foreground">{message}</p>
            <ul className="space-y-1">
              {todayTasks.map((t) => (
                <li key={t.id} className="text-xs text-muted-foreground">
                  • {t.title}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => (step === 0 ? close() : setStep(step - 1))}
            className="flex-1 py-2 rounded-md border border-border text-sm hover:bg-secondary"
          >
            {step === 0 ? 'Close' : 'Back'}
          </button>
          <button
            onClick={() => (step === 2 ? close() : setStep(step + 1))}
            className="flex-1 py-2 rounded-md bg-primary hover:bg-primary/90 text-sm"
          >
            {step === 2 ? 'Start the day' : 'Next'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
