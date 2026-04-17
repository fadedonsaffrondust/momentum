import clsx from 'clsx';
import type { Task } from '@momentum/shared';
import { formatMinutes } from '../lib/format';

interface Props {
  tasks: Task[];
  capacityMinutes: number;
}

export function TimeBudgetBar({ tasks, capacityMinutes }: Props) {
  const planned = tasks
    .filter((t) => t.status !== 'done')
    .reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);

  const ratio = capacityMinutes > 0 ? planned / capacityMinutes : 0;
  const pct = Math.min(100, ratio * 100);
  const over = planned - capacityMinutes;

  const state: 'ok' | 'warn' | 'over' =
    ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-m-fg-muted">
        <span>
          Planned: <span className="text-m-fg-secondary">{formatMinutes(planned)}</span> /{' '}
          {formatMinutes(capacityMinutes)}
        </span>
        {state === 'over' && (
          <span className="text-red-400">
            {formatMinutes(over)} over capacity — consider deferring.
          </span>
        )}
        {state === 'warn' && <span className="text-amber-400">Full day. Protect focus.</span>}
        {state === 'ok' && <span className="text-emerald-400">Room to breathe.</span>}
      </div>
      <div className="h-2 rounded-full bg-m-surface overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all duration-200',
            state === 'ok' && 'bg-emerald-500/80',
            state === 'warn' && 'bg-amber-500/80',
            state === 'over' && 'bg-red-500/80',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
