import clsx from 'clsx';
import { useCallback, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Task, Role, UserSummary } from '@momentum/shared';
import { formatMinutes, formatTimeAgo } from '../lib/format';
import { useMe, useUsers } from '../api/hooks';
import { Avatar } from './Avatar';

interface Props {
  task: Task;
  role: Role | undefined;
  selected: boolean;
  onSelect: () => void;
  /** When true, wires the card up as a dnd-kit draggable source (Today view). */
  draggable?: boolean;
  /**
   * When true, render the task's status as a pill in the meta row. Used on
   * the Team view where the column represents a teammate (not a status)
   * so the stage needs to be called out on the card itself.
   */
  showStatus?: boolean;
}

const priorityColor: Record<Task['priority'], string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#a1a1aa',
};

const STATUS_STYLE: Record<Task['status'], { label: string; className: string }> = {
  in_progress: {
    label: 'In Progress',
    className: 'border-primary/40 bg-primary/10 text-primary',
  },
  todo: {
    label: 'Up Next',
    className: 'border-border bg-secondary text-secondary-foreground',
  },
  done: {
    label: 'Done',
    className: 'border-border/60 bg-muted/40 text-muted-foreground',
  },
};

export function TaskCard({
  task,
  role,
  selected,
  onSelect,
  draggable = false,
  showStatus = false,
}: Props) {
  const statusStyle = STATUS_STYLE[task.status];
  const meQ = useMe();
  const usersQ = useUsers();
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useDraggable({ id: task.id, disabled: !draggable });

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

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      if (draggable) drag.setNodeRef(el);
    },
    [draggable, drag],
  );

  return (
    <div
      ref={setRefs}
      {...(draggable ? drag.attributes : {})}
      {...(draggable ? drag.listeners : {})}
      role="button"
      tabIndex={-1}
      onClick={onSelect}
      style={{ borderLeftColor: priorityColor[task.priority] }}
      className={clsx(
        'group rounded-lg border-l-4 border border-border bg-card/60 p-3 cursor-pointer transition',
        'hover:border-border',
        selected && 'ring-2 ring-primary/80 border-border',
        task.status === 'done' && 'opacity-60',
        draggable && drag.isDragging && 'opacity-30',
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={clsx(
            'flex-1 min-w-0 text-sm text-foreground leading-snug break-words',
            task.status === 'done' && 'line-through',
          )}
        >
          {task.title}
        </div>
        {assignee && (
          <Avatar user={assignee} size="xs" className="mt-0.5 shrink-0" />
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {showStatus && (
          <span
            className={clsx(
              'px-2 py-0.5 rounded-sm text-2xs font-medium border',
              statusStyle.className,
            )}
          >
            {statusStyle.label}
          </span>
        )}
        {role && (
          <span
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: role.color + '26', color: role.color }}
          >
            {role.name}
          </span>
        )}
        {task.estimateMinutes != null && (
          <span className="text-muted-foreground">{formatMinutes(task.estimateMinutes)}</span>
        )}
        {task.status === 'done' && task.actualMinutes != null && (
          <span className="text-emerald-500">
            actual {formatMinutes(task.actualMinutes)}
          </span>
        )}
        <span className="ml-auto text-muted-foreground/70">{formatTimeAgo(task.createdAt)}</span>
      </div>
    </div>
  );
}
