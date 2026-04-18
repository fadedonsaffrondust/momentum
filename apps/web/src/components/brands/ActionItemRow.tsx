import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { BrandActionItem, UserSummary } from '@momentum/shared';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '../Avatar';
import { useMe, useUsers } from '../../api/hooks';
import { useUiStore } from '../../store/ui';

interface Props {
  item: BrandActionItem;
  onToggleDone: () => void;
  onSendToToday: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}

export function ActionItemRow({ item, onToggleDone, onSendToToday, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const isDone = item.status === 'done';

  const usersQ = useUsers();
  const meQ = useMe();
  const openAssigneePicker = useUiStore((s) => s.openAssigneePicker);
  const users = usersQ.data ?? [];

  const creator = useMemo<UserSummary | undefined>(
    () => users.find((u) => u.id === item.creatorId),
    [users, item.creatorId],
  );
  const assignee = useMemo<UserSummary | undefined>(
    () =>
      item.assigneeId ? users.find((u) => u.id === item.assigneeId) : undefined,
    [users, item.assigneeId],
  );

  const commit = () => {
    setEditing(false);
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text) onEdit(trimmed);
    else setEditText(item.text);
  };

  const dateLabel = (() => {
    const ref = item.meetingDate ?? item.createdAt.slice(0, 10);
    const diff = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
    if (diff === 0) return 'today';
    if (diff === 1) return '1d';
    return `${diff}d`;
  })();

  // Hide creator avatar when the current user IS the creator — the row
  // stays quiet for the default "my own action item" case.
  const showCreatorAvatar = creator !== undefined && meQ.data?.id !== creator.id;

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    openAssigneePicker({
      kind: 'action-item',
      brandId: item.brandId,
      itemId: item.id,
      currentAssigneeId: item.assigneeId,
    });
  };

  return (
    <div className="group flex items-start gap-2 py-1.5 px-1 rounded hover:bg-card/40 transition text-sm">
      <button
        onClick={onToggleDone}
        className={clsx(
          'mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition',
          isDone
            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
            : 'border-border hover:border-primary',
        )}
        aria-label={isDone ? 'Reopen' : 'Mark done'}
      >
        {isDone && <span className="text-[10px]">✓</span>}
      </button>

      {showCreatorAvatar && creator && (
        <Avatar user={creator} size="xs" className="mt-0.5" />
      )}

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setEditText(item.text);
                setEditing(false);
              }
            }}
            className="w-full bg-background border border-border rounded px-2 py-0.5 text-xs focus:outline-none focus:border-primary"
          />
        ) : (
          <span
            className={clsx(
              'text-foreground break-words',
              isDone && 'line-through text-muted-foreground',
            )}
          >
            {item.text}
          </span>
        )}

        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          {item.owner && <span>{item.owner}</span>}
          {item.dueDate && (
            <span className={item.dueDate < new Date().toISOString().slice(0, 10) ? 'text-red-400' : ''}>
              due {item.dueDate}
            </span>
          )}
          <span>{dateLabel}</span>
          {item.linkedTaskId && (
            <span className="text-primary">In Today</span>
          )}
        </div>
      </div>

      {/* Assignee slot — always clickable to (re)assign. Unassigned
          items render a small dashed "+" placeholder so the click
          target is discoverable even before an assignee exists. */}
      <button
        type="button"
        onClick={openPicker}
        className="shrink-0 mt-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
        title={
          assignee
            ? `Assigned to ${assignee.displayName || assignee.email}`
            : 'Assign a teammate'
        }
        aria-label={assignee ? 'Reassign' : 'Assign'}
      >
        {assignee ? (
          <Avatar user={assignee} size="xs" showTooltip={false} />
        ) : (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-dashed border-border text-[8px] text-muted-foreground/70 hover:border-primary hover:text-primary transition">
            +
          </span>
        )}
      </button>

      <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition mt-0.5">
        {!isDone && !item.linkedTaskId && (
          <button
            onClick={onSendToToday}
            className="p-1 text-muted-foreground/70 hover:text-primary"
            title="Send to Today"
          >
            <ArrowRight size={14} />
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="p-1 text-muted-foreground/70 hover:text-foreground"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-muted-foreground/70 hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
