import clsx from 'clsx';
import type { Task, Role, TaskColumn } from '@momentum/shared';
import { TaskCard } from './TaskCard';
import { useUiStore } from '../store/ui';

interface Props {
  column: TaskColumn;
  title: string;
  tasks: Task[];
  roles: Role[];
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;
}

const TITLE_HINT: Record<TaskColumn, string> = {
  up_next: 'Press Enter to start',
  in_progress: 'Press Space to complete',
  done: 'Nice work.',
};

export function KanbanColumn({
  column,
  title,
  tasks,
  roles,
  editingTaskId,
  setEditingTaskId,
}: Props) {
  const focusedColumn = useUiStore((s) => s.focusedColumn);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);
  const setFocusedColumn = useUiStore((s) => s.setFocusedColumn);
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const isFocused = focusedColumn === column;

  return (
    <section
      className={clsx(
        'flex flex-col rounded-xl border transition h-full min-h-0',
        isFocused ? 'border-border bg-background/85' : 'border-border/60 bg-background/60',
      )}
    >
      <header className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{tasks.length} · {TITLE_HINT[column]}</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 && column === 'up_next' && (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-xs text-muted-foreground">No tasks up next.</p>
            <p className="text-2xs text-muted-foreground/70">
              Press <kbd className="font-mono">/</kbd> or <kbd className="font-mono">n</kbd> to add one.
            </p>
          </div>
        )}
        {tasks.length === 0 && column === 'in_progress' && (
          <p className="text-xs text-muted-foreground/70 text-center py-8">
            Nothing in progress. Press <kbd className="font-mono">Enter</kbd> on a task to start.
          </p>
        )}
        {tasks.length === 0 && column === 'done' && (
          <p className="text-xs text-muted-foreground/70 text-center py-8">
            Nothing done yet today.
          </p>
        )}
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
            editing={editingTaskId === t.id}
            onEditDone={() => setEditingTaskId(null)}
          />
        ))}
      </div>
    </section>
  );
}
