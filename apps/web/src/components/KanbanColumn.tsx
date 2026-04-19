import clsx from 'clsx';
import { useDroppable } from '@dnd-kit/core';
import { CircleCheck, CircleDashed, CirclePlus } from 'lucide-react';
import type { Task, Role, TaskColumn } from '@momentum/shared';
import { TaskCard } from './TaskCard';
import { useUiStore } from '../store/ui';

interface Props {
  column: TaskColumn;
  title: string;
  tasks: Task[];
  roles: Role[];
  /** When true, the column accepts dnd-kit drops and cards are draggable. */
  dnd?: boolean;
}

const TITLE_HINT: Record<TaskColumn, string> = {
  up_next: 'Press Enter to start',
  in_progress: 'Press Enter or Space to complete',
  done: 'Nice work.',
};

export function KanbanColumn({ column, title, tasks, roles, dnd = false }: Props) {
  const focusedColumn = useUiStore((s) => s.focusedColumn);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const setFocusedColumn = useUiStore((s) => s.setFocusedColumn);
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const isFocused = focusedColumn === column;

  const drop = useDroppable({ id: column, disabled: !dnd });

  return (
    <section
      ref={dnd ? drop.setNodeRef : undefined}
      className={clsx(
        // w-full + min-w-0 force the column to fill its wrapper rather
        // than collapsing to its content width (default behavior of a
        // single flex-item child inside a display:flex wrapper).
        'flex flex-col rounded-xl border transition-colors duration-150 h-full w-full min-w-0 min-h-0',
        isFocused ? 'border-border bg-background/85' : 'border-border/60 bg-background/60',
        dnd && drop.isOver && 'border-primary bg-primary/10 ring-1 ring-inset ring-primary/20',
      )}
    >
      <header className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {tasks.length} · {TITLE_HINT[column]}
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {tasks.length === 0 ? (
          // Empty columns vertically center their hint so the column
          // doesn't read as "broken" — Up Next gets a two-line nudge,
          // In Progress and Done each get a single muted line.
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            {column === 'up_next' && (
              <>
                <CirclePlus className="h-7 w-7 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground">No tasks up next.</p>
                <p className="text-2xs text-muted-foreground/70 mt-1">
                  Press <kbd className="font-mono">/</kbd> or <kbd className="font-mono">n</kbd> to
                  add one.
                </p>
              </>
            )}
            {column === 'in_progress' && (
              <>
                <CircleDashed className="h-7 w-7 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground/70">
                  Nothing in progress. Press <kbd className="font-mono">Enter</kbd> on an Up Next
                  task to start.
                </p>
              </>
            )}
            {column === 'done' && (
              <>
                <CircleCheck className="h-7 w-7 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground/70">Nothing done yet today.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                role={t.roleId ? rolesById.get(t.roleId) : undefined}
                selected={selectedTaskId === t.id && isFocused}
                onSelect={() => {
                  setSelectedTaskId(t.id);
                  setFocusedColumn(column);
                }}
                draggable={dnd}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
