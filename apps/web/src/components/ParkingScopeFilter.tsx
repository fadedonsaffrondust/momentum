import clsx from 'clsx';
import { useUiStore, type ParkingScopeFilter as Filter } from '../store/ui';

const OPTIONS: readonly Filter[] = ['mine', 'involving', 'all'] as const;

const LABELS: Record<Filter, string> = {
  mine: 'Mine',
  involving: 'Involving me',
  all: 'All',
};

/**
 * Parkings-view filter (spec §9.5). "Mine" shows parkings the current
 * user created; "Involving me" shows parkings where they appear in
 * `involvedIds[]`; "All" shows every team-visible parking plus the
 * current user's own private ones (which is what `GET /parkings`
 * already returns).
 */
export function ParkingScopeFilter() {
  const current = useUiStore((s) => s.parkingScopeFilter);
  const set = useUiStore((s) => s.setParkingScopeFilter);

  return (
    <div
      role="radiogroup"
      aria-label="Filter parkings"
      data-person-filter="true"
      className="inline-flex items-center gap-0.5 rounded-lg border border-m-border bg-m-surface-40 p-0.5 text-xs"
    >
      {OPTIONS.map((opt) => {
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
