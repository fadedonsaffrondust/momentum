import { useMemo, useState } from 'react';
import type { Brand, BrandMeeting, BrandActionItem } from '@momentum/shared';
import { BrandListItem } from './BrandListItem';

interface Props {
  brands: Brand[];
  meetingsByBrand: Map<string, BrandMeeting[]>;
  actionItemsByBrand: Map<string, BrandActionItem[]>;
  selectedBrandId: string | null;
  onSelectBrand: (id: string) => void;
  onNewBrand: () => void;
  onImport: () => void;
}

export function BrandListRail({
  brands,
  meetingsByBrand,
  actionItemsByBrand,
  selectedBrandId,
  onSelectBrand,
  onNewBrand,
  onImport,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return brands;
    const q = search.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, search]);

  return (
    <aside className="w-[280px] shrink-0 border-r border-m-border-subtle flex flex-col h-full bg-m-bg-60">
      <div className="p-3 border-b border-m-border-subtle">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands…"
          data-task-input="true"
          className="w-full px-3 py-2 bg-m-surface-60 border border-m-border rounded-md text-sm focus:outline-none focus:border-accent text-m-fg placeholder:text-m-fg-dim"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.length === 0 && (
          <p className="text-xs text-m-fg-dim text-center py-8">
            {search ? 'No brands match.' : 'No brands yet.'}
          </p>
        )}
        {filtered.map((b) => (
          <BrandListItem
            key={b.id}
            brand={b}
            meetings={meetingsByBrand.get(b.id) ?? []}
            actionItems={actionItemsByBrand.get(b.id) ?? []}
            selected={selectedBrandId === b.id}
            onClick={() => onSelectBrand(b.id)}
          />
        ))}
      </div>

      <div className="p-3 border-t border-m-border-subtle space-y-2">
        <button
          onClick={onNewBrand}
          className="w-full py-2 rounded-md bg-accent hover:bg-accent-hover text-sm transition"
        >
          + New Brand
        </button>
        <button
          onClick={onImport}
          className="w-full py-2 rounded-md border border-m-border text-xs text-m-fg-muted hover:text-m-fg-strong hover:bg-m-surface-hover transition"
        >
          Import from file
        </button>
      </div>
    </aside>
  );
}
