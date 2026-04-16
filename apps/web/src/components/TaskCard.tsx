import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { Task, Role } from '@momentum/shared';
import { formatMinutes, formatTimeAgo } from '../lib/format';
import { useUpdateTask } from '../api/hooks';

interface Props {
  task: Task;
  role: Role | undefined;
  selected: boolean;
  onSelect: () => void;
  editing: boolean;
  onEditDone: () => void;
}

const priorityBorder: Record<Task['priority'], string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-zinc-600',
};

export function TaskCard({ task, role, selected, onSelect, editing, onEditDone }: Props) {
  const updateTask = useUpdateTask();
  const [title, setTitle] = useState(task.title);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selected]);

  useEffect(() => {
    if (editing) {
      setTitle(task.title);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, task.title]);

  const commit = async () => {
    const next = title.trim();
    if (next && next !== task.title) {
      await updateTask.mutateAsync({ id: task.id, title: next });
    }
    onEditDone();
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={-1}
      onClick={onSelect}
      className={clsx(
        'group rounded-lg border-l-4 border border-zinc-800 bg-zinc-900/60 p-3 cursor-pointer transition',
        'hover:border-zinc-700',
        priorityBorder[task.priority],
        selected && 'ring-2 ring-accent/80 border-zinc-700',
        task.status === 'done' && 'opacity-60',
      )}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            }
            if (e.key === 'Escape') {
              setTitle(task.title);
              onEditDone();
            }
            e.stopPropagation();
          }}
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-accent"
          data-task-edit-input="true"
        />
      ) : (
        <div
          className={clsx(
            'text-sm text-zinc-100 leading-snug break-words',
            task.status === 'done' && 'line-through',
          )}
        >
          {task.title}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-zinc-500">
        {role && (
          <span
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: role.color + '26', color: role.color }}
          >
            {role.name}
          </span>
        )}
        {task.estimateMinutes != null && (
          <span className="text-zinc-400">{formatMinutes(task.estimateMinutes)}</span>
        )}
        {task.status === 'done' && task.actualMinutes != null && (
          <span className="text-emerald-500">
            actual {formatMinutes(task.actualMinutes)}
          </span>
        )}
        <span className="ml-auto text-zinc-600">{formatTimeAgo(task.createdAt)}</span>
      </div>
    </div>
  );
}
