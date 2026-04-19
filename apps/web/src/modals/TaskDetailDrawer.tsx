import { useEffect, useMemo, useRef, useState } from 'react';
import type { UpdateTaskInput } from '@momentum/shared';
import { X } from 'lucide-react';
import type { Priority, Task } from '@momentum/shared';
import { useMe, useRoles, useTasks, useTeamTasks, useUpdateTask, useUsers } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { PropertyPicker, type PropertyPickerItem } from '../components/PropertyPicker';
import { RichDescriptionEditor, isEmptyEditorHtml } from '../components/RichDescriptionEditor';
import { useUiStore } from '../store/ui';
import { todayIso } from '../lib/date';
import { formatMinutes, formatTimeAgo } from '../lib/format';

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const PRIORITY_ITEMS: PropertyPickerItem<Priority>[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

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
 * Edit surface: title, priority, role, estimate, scheduled date. Assignee
 * is edited via the global `AssigneePickerHost`.
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

  // Editable draft — re-initialized whenever the drawer's target task changes.
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [estimate, setEstimate] = useState<number | null>(task?.estimateMinutes ?? null);
  const [scheduledDate, setScheduledDate] = useState<string | null>(task?.scheduledDate ?? null);
  const [roleId, setRoleId] = useState<string | null>(task?.roleId ?? null);
  const [assigneeId, setAssigneeId] = useState<string>(task?.assigneeId ?? '');

  // Sync staged state from the task ONLY when the target task changes.
  // Depending on `task` itself would re-fire on every refetch (autosave
  // causes invalidation) and clobber in-flight edits typed during the
  // save round-trip.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPriority(task.priority);
    setEstimate(task.estimateMinutes);
    setScheduledDate(task.scheduledDate);
    setRoleId(task.roleId);
    setAssigneeId(task.assigneeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  // Escape closes the drawer. Uses capture-phase + stopPropagation so the
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
      flushPendingSave();
      closeDrawer();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [drawerOpen, assigneePickerOpen, slashMenuOpen, closeDrawer]);

  const roles = rolesQ.data ?? [];
  const users = usersQ.data ?? [];
  const assignee = users.find((u) => u.id === assigneeId);
  const creator = task ? users.find((u) => u.id === task.creatorId) : undefined;
  const selectedRole = roles.find((r) => r.id === roleId);

  const roleItems = useMemo<PropertyPickerItem[]>(
    () => [
      {
        value: '',
        label: 'No role',
        leading: <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />,
      },
      ...roles.map((r) => ({
        value: r.id,
        label: r.name,
        leading: (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
        ),
      })),
    ],
    [roles],
  );

  const assigneeItems = useMemo<PropertyPickerItem[]>(
    () =>
      users.map((u) => ({
        value: u.id,
        label: u.displayName || u.email,
        leading: <Avatar user={u} size="xs" showTooltip={false} />,
        hint: u.id === meQ.data?.id ? 'you' : undefined,
        keywords: [u.email],
      })),
    [users, meQ.data?.id],
  );

  // ─── Autosave ────────────────────────────────────────────────────
  // Every edit schedules a debounced save. A refs-based "pending payload"
  // lets us flush cleanly when the user navigates to another task (so the
  // outgoing task's edits don't get silently dropped) or when the drawer
  // unmounts.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ taskId: string; payload: Omit<UpdateTaskInput, 'id'> } | null>(
    null,
  );
  // Latest mutate fn in a ref so cleanup callbacks always see it without
  // needing react-query's object in their deps.
  const mutateRef = useRef(updateTask.mutate);
  mutateRef.current = updateTask.mutate;

  const flushPendingSave = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending) {
      mutateRef.current({ id: pending.taskId, ...pending.payload });
      pendingSaveRef.current = null;
    }
  };

  useEffect(() => {
    if (!task) return;
    const trimmed = title.trim();
    // Don't autosave an empty title — that would clobber the stored title.
    if (!trimmed) return;

    const nextDescription = isEmptyEditorHtml(description) ? null : description;

    const unchanged =
      trimmed === task.title &&
      (nextDescription ?? null) === (task.description ?? null) &&
      priority === task.priority &&
      estimate === task.estimateMinutes &&
      scheduledDate === task.scheduledDate &&
      roleId === task.roleId &&
      assigneeId === task.assigneeId;
    if (unchanged) {
      // State matches the task — cancel any pending save that was
      // scheduled for a now-stale value (e.g., user typed then undid,
      // or the task just switched and state hasn't diverged from server).
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = null;
      return;
    }

    pendingSaveRef.current = {
      taskId: task.id,
      payload: {
        title: trimmed,
        description: nextDescription,
        priority,
        estimateMinutes: estimate,
        scheduledDate,
        roleId,
        assigneeId,
      },
    };

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current;
      if (pending) {
        mutateRef.current({ id: pending.taskId, ...pending.payload });
        pendingSaveRef.current = null;
      }
      saveTimerRef.current = null;
    }, 500);
    // `task` is intentionally NOT a dep: depending on it causes the
    // autosave to fire on task-switch with state values that belong to
    // the previous task (since setState from the task-sync effect hasn't
    // committed yet), resulting in stale writes. State-value deps alone
    // ensure the effect only runs after the state has actually caught up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, priority, estimate, scheduledDate, roleId, assigneeId]);

  // When the drawer target changes (j/k-navigation) or unmounts, flush any
  // pending autosave for the outgoing task. Cleanup sees the previous
  // render's refs, which still hold the outgoing task's payload.
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

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
          <header className="px-5 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Task detail
            </div>
            <button
              type="button"
              onClick={() => {
                flushPendingSave();
                closeDrawer();
              }}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-lg text-foreground font-medium px-0 py-1 border-b border-border/60 focus:outline-none focus:border-primary"
            />

            {/* Compact property panel — single row per field, Notion-style. */}
            <div className="rounded-md border border-border/60 divide-y divide-border/60 text-sm">
              {/* Assignee */}
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-20 shrink-0">
                  Assignee
                </span>
                <PropertyPicker
                  items={assigneeItems}
                  value={assigneeId}
                  onChange={(v) => setAssigneeId(v)}
                  searchable={users.length > 5}
                  searchPlaceholder="Search team…"
                  emptyLabel="No teammates."
                >
                  {assignee ? (
                    <>
                      <Avatar user={assignee} size="xs" showTooltip={false} />
                      <span className="text-foreground truncate">
                        {assignee.displayName || assignee.email}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-dashed border-border text-[9px] text-muted-foreground/70 shrink-0">
                        ?
                      </span>
                      <span className="text-muted-foreground truncate">Unassigned</span>
                    </>
                  )}
                </PropertyPicker>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-20 shrink-0">
                  Priority
                </span>
                <PropertyPicker<Priority>
                  items={PRIORITY_ITEMS}
                  value={priority}
                  onChange={(v) => setPriority(v)}
                >
                  <span className="text-foreground truncate">{PRIORITY_LABELS[priority]}</span>
                </PropertyPicker>
              </div>

              {/* Role */}
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-20 shrink-0">
                  Role
                </span>
                <PropertyPicker
                  items={roleItems}
                  value={roleId ?? ''}
                  onChange={(v) => setRoleId(v || null)}
                  searchable={roles.length > 5}
                  searchPlaceholder="Search roles…"
                  emptyLabel="No roles."
                >
                  {selectedRole ? (
                    <>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: selectedRole.color }}
                      />
                      <span className="truncate" style={{ color: selectedRole.color }}>
                        {selectedRole.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                      <span className="text-muted-foreground truncate">No role</span>
                    </>
                  )}
                </PropertyPicker>
              </div>

              {/* Estimate */}
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-20 shrink-0">
                  Estimate
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={estimate ?? ''}
                    onChange={(e) =>
                      setEstimate(e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="minutes"
                    className="w-20 bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/70"
                  />
                  {estimate !== null && estimate > 0 && (
                    <span className="text-xs text-muted-foreground">{formatMinutes(estimate)}</span>
                  )}
                </div>
              </div>

              {/* Scheduled date */}
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-20 shrink-0">
                  Scheduled
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="date"
                    value={scheduledDate ?? ''}
                    onChange={(e) => setScheduledDate(e.target.value || null)}
                    className="bg-transparent text-foreground focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setScheduledDate(todayIso())}
                    className="text-2xs text-primary hover:underline"
                  >
                    today
                  </button>
                  {scheduledDate && (
                    <button
                      type="button"
                      onClick={() => setScheduledDate(null)}
                      className="text-2xs text-muted-foreground/70 hover:text-foreground transition-colors duration-150"
                    >
                      unschedule
                    </button>
                  )}
                </div>
              </div>
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
                  value={description}
                  onChange={setDescription}
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

          <footer className="px-5 py-3 border-t border-border/60 flex items-center justify-between shrink-0">
            <div className="text-[10px] text-muted-foreground/70">
              {updateTask.isPending ? 'Saving…' : 'Saved'} · Esc to close · j / k still navigate
            </div>
            <button
              type="button"
              onClick={() => {
                flushPendingSave();
                closeDrawer();
              }}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-secondary text-sm transition-colors duration-150"
            >
              Close
            </button>
          </footer>
        </>
      ) : drawerOpen ? (
        // Drawer is open but no task is in the cache (navigated away,
        // deleted, or nothing selected). Keep the chrome so the user can
        // close cleanly; show a simple empty state in the body.
        <>
          <header className="px-5 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Task detail
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground px-5">
            No task selected. Press <kbd className="mx-1 font-mono">j</kbd> /{' '}
            <kbd className="mx-1 font-mono">k</kbd> to pick one.
          </div>
        </>
      ) : null}
    </aside>
  );
}
