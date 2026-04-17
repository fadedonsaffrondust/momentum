import { useMemo, useRef, useState } from 'react';
import type { Parking } from '@momentum/shared';
import { useParkings, useRoles } from '../api/hooks';
import { useUiStore } from '../store/ui';
import { ParkingInputBar } from '../components/ParkingInputBar';
import { ParkingCard } from '../components/ParkingCard';
import { RoleFilterBar } from '../components/RoleFilterBar';
import { useKeyboardController } from '../hooks/useKeyboardController';
import { todayIso, tomorrowIso } from '../lib/date';
import { formatDateShort } from '../lib/format';

interface Group {
  key: string;
  label: string;
  items: Parking[];
}

export function ParkingsPage() {
  const parkingsQ = useParkings();
  const rolesQ = useRoles();
  const roleFilter = useUiStore((s) => s.roleFilter);
  const selectedParkingId = useUiStore((s) => s.selectedParkingId);
  const setSelectedParkingId = useUiStore((s) => s.setSelectedParkingId);
  const [editingParkingId, setEditingParkingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const rawParkings = parkingsQ.data ?? [];
  const parkings = useMemo(
    () => (roleFilter ? rawParkings.filter((p) => p.roleId === roleFilter) : rawParkings),
    [rawParkings, roleFilter],
  );

  const roles = rolesQ.data ?? [];
  const rolesById = new Map(roles.map((r) => [r.id, r]));

  const groups = useMemo(() => buildGroups(parkings), [parkings]);

  // Flat order for keyboard navigation — matches the rendered order.
  const flatOrder = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useKeyboardController({
    tasks: [], // today view data; not used in parkings
    parkings: flatOrder,
    editingTaskId: editingParkingId,
    setEditingTaskId: setEditingParkingId,
    onParkingToggleExpand: (id) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
  });

  // Not auto-focused on mount — `/` (handled globally) focuses the input.

  return (
    <div className="h-full flex flex-col gap-4 px-6 py-5 overflow-hidden">
      <div>
        <h1 className="text-lg text-accent">Parkings</h1>
        <p className="text-xs text-m-fg-muted mt-0.5">
          Topics to bring up at upcoming dailies.
        </p>
      </div>
      <ParkingInputBar ref={inputRef} />
      <RoleFilterBar />

      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        <div className="max-w-3xl space-y-6">
          {groups.length === 0 && (
            <p className="text-sm text-m-fg-muted py-8 text-center">
              Nothing parked. Type above to capture a topic for the next daily.
            </p>
          )}
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="text-[10px] uppercase tracking-widest text-m-fg-muted font-semibold mb-2">
                {group.label} · {group.items.length}
              </h2>
              <ul className="space-y-2">
                {group.items.map((p) => (
                  <li key={p.id}>
                    <ParkingCard
                      parking={p}
                      role={p.roleId ? rolesById.get(p.roleId) : undefined}
                      selected={selectedParkingId === p.id}
                      expanded={expandedIds.has(p.id)}
                      onSelect={() => setSelectedParkingId(p.id)}
                      onToggleExpand={() => {
                        setExpandedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          return next;
                        });
                      }}
                      editing={editingParkingId === p.id}
                      onEditDone={() => setEditingParkingId(null)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildGroups(parkings: Parking[]): Group[] {
  const today = todayIso();
  const tomorrow = tomorrowIso();

  const map = new Map<string, Parking[]>();
  for (const p of parkings) {
    const key = p.targetDate ?? '__unscheduled__';
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }

  // Keep "discussed" items at the bottom of each group.
  for (const [, arr] of map) {
    arr.sort((a, b) => {
      if (a.status === 'discussed' && b.status !== 'discussed') return 1;
      if (b.status === 'discussed' && a.status !== 'discussed') return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  const entries = [...map.entries()];
  // Sort groups: scheduled dates ascending, then unscheduled last.
  entries.sort((a, b) => {
    if (a[0] === '__unscheduled__') return 1;
    if (b[0] === '__unscheduled__') return -1;
    return a[0].localeCompare(b[0]);
  });

  return entries.map(([key, items]) => {
    let label: string;
    if (key === '__unscheduled__') label = 'Unscheduled';
    else if (key === today) label = "Today's daily";
    else if (key === tomorrow) label = "Tomorrow's daily";
    else if (key < today) label = `Overdue · ${formatDateShort(key)}`;
    else label = formatDateShort(key);
    return { key, label, items };
  });
}
