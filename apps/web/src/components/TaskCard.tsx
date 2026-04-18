import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { Task, Role, UserSummary } from '@momentum/shared';
import { formatMinutes, formatTimeAgo } from '../lib/format';
import { useMe, useUpdateTask, useUsers } from '../api/hooks';
import { Avatar } from './Avatar';

interface Props {
  task: Task;
  role: Role | undefined;
  selected: boolean;
  onSelect: () => void;
  editing: boolean;
  onEditDone: () => void;
}

const priorityColor: Record<Task['priority'], string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#a1a1aa',
};

export function TaskCard({ task, role, selected, onSelect, editing, onEditDone }: Props) {
  const updateTask = useUpdateTask();
  const meQ = useMe();
  const usersQ = useUsers();
  const [title, setTitle] = useState(task.title);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show the assignee avatar only when the task is assigned to someone
  // other than the current user — reduces visual noise for the common
  // "own tasks" case (spec §9.3).
  const assignee: UserSummary | undefined =
    meQ.data && task.assigneeId !== meQ.data.id
      ? (usersQ.data ?? []).find((u) => u.id === task.assigneeId)
      : undefined;

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
      style={{ borderLeftColor: priorityColor[task.priority] }}
      className={clsx(
        'group rounded-lg border-l-4 border border-m-border bg-m-surface-60 p-3 cursor-pointer transition',
        'hover:border-m-border-strong',
        selected && 'ring-2 ring-accent/80 border-m-border-strong',
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
          className="w-full bg-m-bg border border-m-border rounded px-2 py-1 text-sm text-m-fg focus:outline-none focus:border-accent"
          data-task-edit-input="true"
        />
      ) : (
        <div className="flex items-start gap-2">
          <div
            className={clsx(
              'flex-1 min-w-0 text-sm text-m-fg leading-snug break-words',
              task.status === 'done' && 'line-through',
            )}
          >
            {task.title}
          </div>
          {assignee && (
            <Avatar user={assignee} size="xs" className="mt-0.5 shrink-0" />
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-m-fg-muted">
        {role && (
          <span
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: role.color + '26', color: role.color }}
          >
            {role.name}
          </span>
        )}
        {task.estimateMinutes != null && (
          <span className="text-m-fg-tertiary">{formatMinutes(task.estimateMinutes)}</span>
        )}
        {task.status === 'done' && task.actualMinutes != null && (
          <span className="text-emerald-500">
            actual {formatMinutes(task.actualMinutes)}
          </span>
        )}
        <span className="ml-auto text-m-fg-dim">{formatTimeAgo(task.createdAt)}</span>
      </div>
    </div>
  );
}
