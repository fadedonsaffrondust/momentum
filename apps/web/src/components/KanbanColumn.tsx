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
        isFocused ? 'border-m-border-strong bg-m-bg-60' : 'border-m-border-subtle bg-m-bg-30',
      )}
    >
      <header className="px-4 py-3 border-b border-m-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-m-fg-muted">{title}</h2>
          <p className="text-xs text-m-fg-dim mt-0.5">{tasks.length} · {TITLE_HINT[column]}</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 && (
          <p className="text-xs text-m-fg-dim text-center py-6">No tasks.</p>
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
