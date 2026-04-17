import { useState } from 'react';
import clsx from 'clsx';
import type { BrandActionItem } from '@momentum/shared';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';

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

  return (
    <div className="group flex items-start gap-2 py-1.5 px-1 rounded hover:bg-m-surface-40 transition text-sm">
      <button
        onClick={onToggleDone}
        className={clsx(
          'mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition',
          isDone
            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
            : 'border-m-border-strong hover:border-accent',
        )}
        aria-label={isDone ? 'Reopen' : 'Mark done'}
      >
        {isDone && <span className="text-[10px]">✓</span>}
      </button>

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
            className="w-full bg-m-bg border border-m-border rounded px-2 py-0.5 text-xs focus:outline-none focus:border-accent"
          />
        ) : (
          <span
            className={clsx(
              'text-m-fg-strong break-words',
              isDone && 'line-through text-m-fg-muted',
            )}
          >
            {item.text}
          </span>
        )}

        <div className="flex items-center gap-2 mt-0.5 text-xs text-m-fg-muted">
          {item.owner && <span>{item.owner}</span>}
          {item.dueDate && (
            <span className={item.dueDate < new Date().toISOString().slice(0, 10) ? 'text-red-400' : ''}>
              due {item.dueDate}
            </span>
          )}
          <span>{dateLabel}</span>
          {item.linkedTaskId && (
            <span className="text-accent">In Today</span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition mt-0.5">
        {!isDone && !item.linkedTaskId && (
          <button
            onClick={onSendToToday}
            className="p-1 text-m-fg-dim hover:text-accent"
            title="Send to Today"
          >
            <ArrowRight size={14} />
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="p-1 text-m-fg-dim hover:text-m-fg-strong"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-m-fg-dim hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
