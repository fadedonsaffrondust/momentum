import clsx from 'clsx';
import type { Brand, BrandMeeting, BrandActionItem } from '@momentum/shared';
import { HealthPill } from './HealthPill';
import { computeBrandHealth } from '../../../hooks/useBrandHealth';
import { useBrandUnseen } from '../../../hooks/useBrandUnseen';
import { formatTimeAgo } from '../../../lib/format';

interface Props {
  brand: Brand;
  meetings: BrandMeeting[];
  actionItems: BrandActionItem[];
  selected: boolean;
  onClick: () => void;
}

export function BrandListItem({ brand, meetings, actionItems, selected, onClick }: Props) {
  const health = computeBrandHealth(meetings, actionItems);
  const hasUnseen = useBrandUnseen(brand.id);

  return (
    <button
      onClick={onClick}
      className={clsx(
        'group w-full text-left px-3 py-2.5 rounded-lg transition',
        selected
          ? 'bg-primary/10 border border-primary/30'
          : 'border border-transparent hover:bg-card/60',
        brand.status === 'importing' && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2">
        <HealthPill status={health} />
        <span className="flex-1 text-sm text-foreground truncate font-medium">{brand.name}</span>
        {hasUnseen && !selected && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
            aria-label="New activity"
            title="New activity since your last visit"
          />
        )}
        {brand.status === 'importing' && (
          <span className="text-[9px] text-primary animate-pulse">importing…</span>
        )}
      </div>
      <div className="mt-0.5 pl-[14px] text-[10px] text-muted-foreground/70">
        {brand.status === 'import_failed' ? 'Import failed' : formatTimeAgo(brand.updatedAt)}
      </div>
    </button>
  );
}
