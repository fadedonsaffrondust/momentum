import { useEffect, useMemo, useState } from 'react';
import type { Priority, Task } from '@momentum/shared';
import { useMe, useRoles, useTasks, useTeamTasks, useUpdateTask, useUsers } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { RichDescriptionEditor, isEmptyEditorHtml } from '../components/RichDescriptionEditor';
import { useAutosaveForm } from '../hooks/useAutosaveForm';
import { useUiStore } from '../store/ui';
import { formatTimeAgo } from '../lib/format';
import { DrawerHeader } from './taskDrawer/DrawerHeader';
import { DrawerFooter } from './taskDrawer/DrawerFooter';
import { AssigneeField } from './taskDrawer/Fields/AssigneeField';
import { PriorityField } from './taskDrawer/Fields/PriorityField';
import { RoleField } from './taskDrawer/Fields/RoleField';
import { EstimateField } from './taskDrawer/Fields/EstimateField';
import { ScheduleField } from './taskDrawer/Fields/ScheduleField';

interface DraftValues {
  title: string;
  description: string;
  priority: Priority;
  estimate: number | null;
  scheduledDate: string | null;
  roleId: string | null;
  assigneeId: string;
}

/**
 * Task detail drawer — non-modal, pinned to the right edge of the viewport.
 * Opens when `drawerOpen` is true; displays the task identified by
 * `selectedTaskId`. As the selection changes on the page behind (via j/k
 * or click), the drawer re-renders with the new task — it's a live
 * inspector, not a modal.
 *
 * Layout coexistence: the main content area of AppShell reserves right
 * padding equal to this drawer's width while open, so the Today / Team
 * grids reflow from 3 → 2 columns rather than letting content slip under
 * the drawer.
 *
 * Edit surface: title, priority, role, estimate, scheduled date, assignee.
 * Every edit autosaves via `useAutosaveForm` (500ms debounce, flush on
 * task switch, flush on close, flush on Escape, flush on unmount).
 */
export function TaskDetailDrawer() {
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const closeDrawer = useUiStore((s) => s.closeDrawer);
  const taskId = useUiStore((s) => s.selectedTaskId);
  const assigneePickerOpen = useUiStore((s) => s.assigneePickerTarget !== null);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);

  const teamTasksQ = useTeamTasks();
  const tasksQ = useTasks();

  const task = useMemo<Task | undefined>(() => {
    if (!taskId) return undefined;
    const flatTeam = (teamTasksQ.data?.sections ?? []).flatMap((s) => s.tasks);
    const fromTeam = flatTeam.find((t) => t.id === taskId);
    if (fromTeam) return fromTeam;
    return (tasksQ.data ?? []).find((t) => t.id === taskId);
  }, [taskId, teamTasksQ.data, tasksQ.data]);

  const meQ = useMe();
  const usersQ = useUsers();
  const rolesQ = useRoles();
  const updateTask = useUpdateTask();

  const initial = useMemo<DraftValues>(
    () => ({
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'medium',
      estimate: task?.estimateMinutes ?? null,
      scheduledDate: task?.scheduledDate ?? null,
      roleId: task?.roleId ?? null,
      assigneeId: task?.assigneeId ?? '',
    }),
    [task],
  );

  const { values, setField, status, flush } = useAutosaveForm<DraftValues>({
    initial,
    debounceMs: 500,
    resetKey: task?.id,
    isUnchanged: (v) => {
      if (!task) return true;
      const trimmed = v.title.trim();
      // Empty title would clobber the stored title — treat as no-op.
      if (!trimmed) return true;
      const description = isEmptyEditorHtml(v.description) ? null : v.description;
      return (
        trimmed === task.title &&
        (description ?? null) === (task.description ?? null) &&
        v.priority === task.priority &&
        v.estimate === task.estimateMinutes &&
        v.scheduledDate === task.scheduledDate &&
        v.roleId === task.roleId &&
        v.assigneeId === task.assigneeId
      );
    },
    onSave: (v) => {
      if (!task) return;
      const trimmed = v.title.trim();
      if (!trimmed) return;
      const description = isEmptyEditorHtml(v.description) ? null : v.description;
      updateTask.mutate({
        id: task.id,
        title: trimmed,
        description,
        priority: v.priority,
        estimateMinutes: v.estimate,
        scheduledDate: v.scheduledDate,
        roleId: v.roleId,
        assigneeId: v.assigneeId,
      });
    },
  });

  const handleClose = () => {
    flush();
    closeDrawer();
  };

  // Escape closes the drawer. Capture-phase + stopPropagation so the
  // assignee picker (or any inner modal) gets Escape first when it's open.
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Let inner modals (assignee / involved picker) and the slash
      // command menu claim Escape before the drawer does.
      if (assigneePickerOpen || slashMenuOpen) return;
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
    // handleClose closes over flush + closeDrawer, both stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, assigneePickerOpen, slashMenuOpen]);

  const roles = rolesQ.data ?? [];
  const users = usersQ.data ?? [];
  const creator = task ? users.find((u) => u.id === task.creatorId) : undefined;

  return (
    <aside
      aria-label="Task detail"
      aria-hidden={!drawerOpen}
      className={[
        'fixed right-0 top-0 h-screen z-40 flex flex-col',
        'w-full md:w-[640px]',
        'bg-card border-l border-border shadow-xl',
        'transition-transform duration-150 ease-out',
        drawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none',
      ].join(' ')}
    >
      {drawerOpen && task ? (
        <>
          <DrawerHeader onClose={handleClose} />

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <input
              type="text"
              value={values.title}
              onChange={(e) => setField('title', e.target.value)}
              className="w-full bg-transparent text-lg text-foreground font-medium px-0 py-1 border-b border-border/60 focus:outline-none focus:border-primary"
            />

            {/* Compact property panel — single row per field, Notion-style. */}
            <div className="rounded-md border border-border/60 divide-y divide-border/60 text-sm">
              <AssigneeField
                value={values.assigneeId}
                onChange={(v) => setField('assigneeId', v)}
                users={users}
                meId={meQ.data?.id}
              />
              <PriorityField value={values.priority} onChange={(v) => setField('priority', v)} />
              <RoleField
                value={values.roleId}
                onChange={(v) => setField('roleId', v)}
                roles={roles}
              />
              <EstimateField value={values.estimate} onChange={(v) => setField('estimate', v)} />
              <ScheduleField
                value={values.scheduledDate}
                onChange={(v) => setField('scheduledDate', v)}
              />
            </div>

            {/* Description — definition of done, context, notes. */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Description
                </span>
                <span className="text-2xs text-muted-foreground/70">
                  Type <code>/</code> for formatting options
                </span>
              </div>
              <div className="rounded-md border border-border/60 px-3 py-2 focus-within:border-primary transition-colors duration-150">
                <RichDescriptionEditor
                  value={values.description}
                  onChange={(v) => setField('description', v)}
                  onSlashMenuOpenChange={setSlashMenuOpen}
                />
              </div>
            </div>

            {/* Meta row (read-only) */}
            <div className="pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-2xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                {creator && <Avatar user={creator} size="xs" showTooltip={false} />}
                <span>
                  Created by{' '}
                  <span className="text-foreground">
                    {creator ? creator.displayName || creator.email : 'Unknown'}
                  </span>{' '}
                  · {formatTimeAgo(task.createdAt)}
                </span>
              </div>
              <div className="text-right">
                {task.status === 'done' && task.completedAt ? (
                  <>Done {formatTimeAgo(task.completedAt)}</>
                ) : task.startedAt ? (
                  <>Started {formatTimeAgo(task.startedAt)}</>
                ) : (
                  <>{task.status}</>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter
            autosaveStatus={status}
            mutationPending={updateTask.isPending}
            onClose={handleClose}
          />
        </>
      ) : drawerOpen ? (
        // Drawer is open but no task is in the cache (navigated away,
        // deleted, or nothing selected). Keep the chrome so the user can
        // close cleanly; show a simple empty state in the body.
        <>
          <DrawerHeader onClose={closeDrawer} />
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground px-5">
            No task selected. Press <kbd className="mx-1 font-mono">j</kbd> /{' '}
            <kbd className="mx-1 font-mono">k</kbd> to pick one.
          </div>
        </>
      ) : null}
    </aside>
  );
}
