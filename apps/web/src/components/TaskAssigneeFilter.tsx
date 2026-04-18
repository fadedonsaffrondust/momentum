import clsx from 'clsx';
import { useUiStore, type TaskAssigneeFilter as Filter } from '../store/ui';

interface Props {
  /** Custom option set — defaults to ['mine', 'everyone']. */
  options?: readonly Filter[];
}

const LABELS: Record<Filter, string> = {
  mine: 'Mine',
  everyone: 'Everyone',
};

/**
 * Two-chip filter toggle for task lists (Today + Backlog). Persists the
 * choice in the UI store so switching views feels stable. Spec §9.3 /
 * §9.4 default is "Mine".
 */
export function TaskAssigneeFilter({
  options = ['mine', 'everyone'] as const,
}: Props) {
  const current = useUiStore((s) => s.taskAssigneeFilter);
  const set = useUiStore((s) => s.setTaskAssigneeFilter);

  return (
    <div
      role="radiogroup"
      aria-label="Filter tasks by assignee"
      data-person-filter="true"
      className="inline-flex items-center gap-0.5 rounded-lg border border-m-border bg-m-surface-40 p-0.5 text-xs"
    >
      {options.map((opt) => {
        const active = current === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => set(opt)}
            className={clsx(
              'px-2.5 py-1 rounded-md transition font-medium',
              active
                ? 'bg-accent/20 text-accent'
                : 'text-m-fg-tertiary hover:text-m-fg-strong',
            )}
          >
            {LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}
