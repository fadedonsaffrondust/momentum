import clsx from 'clsx';
import type { Brand, BrandMeeting, BrandActionItem } from '@momentum/shared';
import { HealthPill } from './HealthPill';
import { computeBrandHealth } from '../../hooks/useBrandHealth';
import { formatTimeAgo } from '../../lib/format';

interface Props {
  brand: Brand;
  meetings: BrandMeeting[];
  actionItems: BrandActionItem[];
  selected: boolean;
  onClick: () => void;
}

export function BrandListItem({ brand, meetings, actionItems, selected, onClick }: Props) {
  const health = computeBrandHealth(meetings, actionItems);

  return (
    <button
      onClick={onClick}
      className={clsx(
        'group w-full text-left px-3 py-2.5 rounded-lg transition',
        selected
          ? 'bg-accent/10 border border-accent/30'
          : 'border border-transparent hover:bg-m-surface-60',
        brand.status === 'importing' && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2">
        <HealthPill status={health} />
        <span className="flex-1 text-sm text-m-fg truncate font-medium">
          {brand.name}
        </span>
        {brand.status === 'importing' && (
          <span className="text-[9px] text-accent animate-pulse">importing…</span>
        )}
      </div>
      <div className="mt-0.5 pl-[14px] text-[10px] text-m-fg-dim">
        {brand.status === 'import_failed'
          ? 'Import failed'
          : formatTimeAgo(brand.updatedAt)}
      </div>
    </button>
  );
}
