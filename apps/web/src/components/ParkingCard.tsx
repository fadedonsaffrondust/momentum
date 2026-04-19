import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Parking, Role } from '@momentum/shared';
import { formatTimeAgo } from '../lib/format';
import { useUpdateParking, useUsers } from '../api/hooks';
import { Avatar } from './Avatar';
import { AvatarStack } from './AvatarStack';

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

const priorityColor: Record<Parking['priority'], string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#a1a1aa',
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
  const usersQ = useUsers();
  const [title, setTitle] = useState(parking.title);
  const [notes, setNotes] = useState(parking.notes ?? '');
  const [outcome, setOutcome] = useState(parking.outcome ?? '');
  const ref = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const users = usersQ.data ?? [];
  const creator = useMemo(
    () => users.find((u) => u.id === parking.creatorId),
    [users, parking.creatorId],
  );
  const involved = useMemo(
    () =>
      parking.involvedIds
        .map((id) => users.find((u) => u.id === id))
        .filter((u): u is (typeof users)[number] => u !== undefined),
    [users, parking.involvedIds],
  );

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
  const isPrivate = parking.visibility === 'private';

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={-1}
      onClick={onSelect}
      style={{ borderLeftColor: priorityColor[parking.priority] }}
      className={clsx(
        'group rounded-lg border-l-4 border border-border bg-card/60 p-3 cursor-pointer transition',
        'hover:border-border',
        selected && 'ring-2 ring-primary/80 border-border',
        isDiscussed && 'opacity-70',
        isPrivate && 'bg-card/40/70',
      )}
    >
      <div className="flex items-start gap-2">
        {creator && <Avatar user={creator} size="xs" className="mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0 flex items-start gap-2">
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
              className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
              data-task-edit-input="true"
            />
          ) : (
            <div
              className={clsx(
                'flex-1 text-sm leading-snug break-words flex items-center gap-2',
                isDiscussed && 'line-through',
                isPrivate ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {isPrivate && (
                <LockIcon className="shrink-0 text-muted-foreground" aria-label="Private to you" />
              )}
              <span className="min-w-0">{parking.title}</span>
            </div>
          )}
          {involved.length > 0 && !editing && (
            <AvatarStack users={involved} max={3} size="xs" className="shrink-0 mt-0.5" />
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="shrink-0 text-xs text-muted-foreground/70 hover:text-foreground transition"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {role && (
          <span
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: role.color + '26', color: role.color }}
          >
            {role.name}
          </span>
        )}
        {isDiscussed && <span className="text-emerald-500">discussed</span>}
        {parking.notes && !expanded && <span className="text-muted-foreground/70">• notes</span>}
        <span className="ml-auto text-muted-foreground/70">{formatTimeAgo(parking.createdAt)}</span>
      </div>

      {expanded && (
        <div
          className="mt-3 pt-3 border-t border-border space-y-3 animate-slideUp"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Prep notes
            </span>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void commitNotes()}
              rows={3}
              placeholder="What do you want to bring up?"
              className="mt-1 w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Outcome
            </span>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              onBlur={() => void commitOutcome()}
              rows={2}
              placeholder="Fill in after the daily — what got decided?"
              className="mt-1 w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function LockIcon({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
