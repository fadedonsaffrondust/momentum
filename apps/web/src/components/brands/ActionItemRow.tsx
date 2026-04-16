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

  const age = (() => {
    const diff = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86_400_000);
    if (diff === 0) return 'today';
    if (diff === 1) return '1d';
    return `${diff}d`;
  })();

  return (
    <div className="group flex items-start gap-2 py-1.5 px-1 rounded hover:bg-zinc-900/30 transition text-sm">
      <button
        onClick={onToggleDone}
        className={clsx(
          'mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition',
          isDone
            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
            : 'border-zinc-700 hover:border-accent',
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
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-accent"
          />
        ) : (
          <span
            className={clsx(
              'text-zinc-200 break-words',
              isDone && 'line-through text-zinc-500',
            )}
          >
            {item.text}
          </span>
        )}

        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-600">
          {item.owner && <span>{item.owner}</span>}
          {item.dueDate && (
            <span className={item.dueDate < new Date().toISOString().slice(0, 10) ? 'text-red-400' : ''}>
              due {item.dueDate}
            </span>
          )}
          <span>{age}</span>
          {item.linkedTaskId && (
            <span className="text-accent">In Today</span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition mt-0.5">
        {!isDone && !item.linkedTaskId && (
          <button
            onClick={onSendToToday}
            className="p-0.5 text-zinc-600 hover:text-accent"
            title="Send to Today"
          >
            <ArrowRight size={12} />
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="p-0.5 text-zinc-600 hover:text-zinc-200"
          title="Edit"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-0.5 text-zinc-600 hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
