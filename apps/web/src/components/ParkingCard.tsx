import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { Parking, Role } from '@momentum/shared';
import { formatTimeAgo } from '../lib/format';
import { useUpdateParking } from '../api/hooks';

interface Props {
  parking: Parking;
  role: Role | undefined;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  editing: boolean;
  onEditDone: () => void;
}

const priorityBorder: Record<Parking['priority'], string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-zinc-600',
};

export function ParkingCard({
  parking,
  role,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
  editing,
  onEditDone,
}: Props) {
  const updateParking = useUpdateParking();
  const [title, setTitle] = useState(parking.title);
  const [notes, setNotes] = useState(parking.notes ?? '');
  const [outcome, setOutcome] = useState(parking.outcome ?? '');
  const ref = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selected]);

  useEffect(() => {
    if (editing) {
      setTitle(parking.title);
      setTimeout(() => titleInputRef.current?.select(), 0);
    }
  }, [editing, parking.title]);

  useEffect(() => {
    if (expanded) {
      setNotes(parking.notes ?? '');
      setOutcome(parking.outcome ?? '');
      setTimeout(() => notesRef.current?.focus(), 0);
    }
  }, [expanded, parking.notes, parking.outcome]);

  const commitTitle = async () => {
    const next = title.trim();
    if (next && next !== parking.title) {
      await updateParking.mutateAsync({ id: parking.id, title: next });
    }
    onEditDone();
  };

  const commitNotes = async () => {
    if ((notes || '') !== (parking.notes ?? '')) {
      await updateParking.mutateAsync({ id: parking.id, notes: notes || null });
    }
  };

  const commitOutcome = async () => {
    if ((outcome || '') !== (parking.outcome ?? '')) {
      await updateParking.mutateAsync({ id: parking.id, outcome: outcome || null });
    }
  };

  const isDiscussed = parking.status === 'discussed';

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={-1}
      onClick={onSelect}
      className={clsx(
        'group rounded-lg border-l-4 border border-zinc-800 bg-zinc-900/60 p-3 cursor-pointer transition',
        'hover:border-zinc-700',
        priorityBorder[parking.priority],
        selected && 'ring-2 ring-accent/80 border-zinc-700',
        isDiscussed && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void commitTitle()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commitTitle();
              }
              if (e.key === 'Escape') {
                setTitle(parking.title);
                onEditDone();
              }
              e.stopPropagation();
            }}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-accent"
            data-task-edit-input="true"
          />
        ) : (
          <div
            className={clsx(
              'flex-1 text-sm text-zinc-100 leading-snug break-words',
              isDiscussed && 'line-through',
            )}
          >
            {parking.title}
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="shrink-0 text-xs text-zinc-600 hover:text-zinc-200 transition"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-zinc-500">
        {role && (
          <span
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: role.color + '26', color: role.color }}
          >
            {role.name}
          </span>
        )}
        {isDiscussed && (
          <span className="text-emerald-500">discussed</span>
        )}
        {parking.notes && !expanded && (
          <span className="text-zinc-600">• notes</span>
        )}
        <span className="ml-auto text-zinc-600">{formatTimeAgo(parking.createdAt)}</span>
      </div>

      {expanded && (
        <div
          className="mt-3 pt-3 border-t border-zinc-800 space-y-3 animate-slideUp"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Prep notes
            </span>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void commitNotes()}
              rows={3}
              placeholder="What do you want to bring up?"
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-accent resize-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Outcome
            </span>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              onBlur={() => void commitOutcome()}
              rows={2}
              placeholder="Fill in after the daily — what got decided?"
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-accent resize-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}
