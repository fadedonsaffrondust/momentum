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
    <aside className="w-[280px] shrink-0 border-r border-border/60 flex flex-col h-full bg-background/85">
      <div className="p-3 border-b border-border/60">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands…"
          data-task-input="true"
          className="w-full px-3 py-2 bg-card/60 border border-border rounded-md text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground/70 text-center py-8">
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

      <div className="p-3 border-t border-border/60 space-y-2">
        <button
          onClick={onNewBrand}
          className="w-full py-2 rounded-md bg-primary hover:bg-primary/90 text-sm transition"
        >
          + New Brand
        </button>
        <button
          onClick={onImport}
          className="w-full py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition"
        >
          Import from file
        </button>
      </div>
    </aside>
  );
}
