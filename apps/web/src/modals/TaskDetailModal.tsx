import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Priority, Task } from '@momentum/shared';
import { useRoles, useTasks, useTeamTasks, useUpdateTask, useUsers } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { useUiStore } from '../store/ui';
import { todayIso } from '../lib/date';
import { formatMinutes, formatTimeAgo } from '../lib/format';

/**
 * Task detail modal opened by Enter on /team (spec §9.7, §9.12). Edit
 * surface mirrors the inline-edit capabilities from the Today kanban:
 * title, priority, role, estimate, scheduled date. Assignee is edited
 * via the global `AssigneePickerHost` — click the assignee avatar to
 * open it.
 *
 * Read-only metadata: creator, createdAt, startedAt, completedAt.
 */
export function TaskDetailModal() {
  const taskId = useUiStore((s) => s.selectedDetailTaskId);
  const setSelectedDetailTaskId = useUiStore((s) => s.setSelectedDetailTaskId);
  const close = useCallback(() => setSelectedDetailTaskId(null), [setSelectedDetailTaskId]);
  const openAssigneePicker = useUiStore((s) => s.openAssigneePicker);

  // Look the task up in whichever query has it cached. The /team list
  // is the primary source (that's where the modal opens from), but we
  // also scan the scoped /tasks list so the modal works end-to-end if a
  // future caller opens it from Today or Backlog.
  const teamTasksQ = useTeamTasks();
  const tasksQ = useTasks();

  const task = useMemo<Task | undefined>(() => {
    if (!taskId) return undefined;
    const flatTeam = (teamTasksQ.data?.sections ?? []).flatMap((s) => s.tasks);
    const fromTeam = flatTeam.find((t) => t.id === taskId);
    if (fromTeam) return fromTeam;
    return (tasksQ.data ?? []).find((t) => t.id === taskId);
  }, [taskId, teamTasksQ.data, tasksQ.data]);

  const usersQ = useUsers();
  const rolesQ = useRoles();
  const updateTask = useUpdateTask();

  // Editable draft — re-initialized when the modal opens for a new task.
  const [title, setTitle] = useState(task?.title ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [estimate, setEstimate] = useState<number | null>(task?.estimateMinutes ?? null);
  const [scheduledDate, setScheduledDate] = useState<string | null>(
    task?.scheduledDate ?? null,
  );
  const [roleId, setRoleId] = useState<string | null>(task?.roleId ?? null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setPriority(task.priority);
    setEstimate(task.estimateMinutes);
    setScheduledDate(task.scheduledDate);
    setRoleId(task.roleId);
  }, [task?.id, task]);

  useEffect(() => {
    if (!taskId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [taskId, close]);

  if (!taskId) return null;
  if (!task) {
    // Task was deleted while modal was open — clean up gracefully.
    return null;
  }

  const roles = rolesQ.data ?? [];
  const users = usersQ.data ?? [];
  const assignee = users.find((u) => u.id === task.assigneeId);
  const creator = users.find((u) => u.id === task.creatorId);
  const selectedRole = roles.find((r) => r.id === roleId);

  const dirty =
    title.trim() !== task.title ||
    priority !== task.priority ||
    estimate !== task.estimateMinutes ||
    scheduledDate !== task.scheduledDate ||
    roleId !== task.roleId;

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    updateTask.mutate(
      {
        id: task.id,
        title: trimmed,
        priority,
        estimateMinutes: estimate,
        scheduledDate,
        roleId,
      },
      { onSuccess: () => close() },
    );
  };

  const body = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Task detail"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl p-5 animate-scaleIn">
        <header className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Task detail
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="mt-1 w-full bg-transparent text-lg text-foreground font-medium px-0 py-1 border-b border-border/60 focus:outline-none focus:border-primary"
          />
        </header>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* Assignee — opens the global picker */}
          <button
            type="button"
            onClick={() =>
              openAssigneePicker({
                kind: 'task',
                taskId: task.id,
                currentAssigneeId: task.assigneeId,
              })
            }
            className="flex items-center gap-2 text-left rounded-md border border-border/60 px-3 py-2 hover:border-primary/40 hover:bg-card/60 transition"
          >
            {assignee ? (
              <Avatar user={assignee} size="sm" showTooltip={false} />
            ) : (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-border text-[9px] text-muted-foreground/70">
                ?
              </span>
            )}
            <div className="min-w-0">
              <div className="text-[10px] uppercase text-muted-foreground">Assignee</div>
              <div className="text-foreground truncate">
                {assignee ? assignee.displayName || assignee.email : 'Unassigned'}
              </div>
            </div>
          </button>

          {/* Priority */}
          <label className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2">
            <span className="text-[10px] uppercase text-muted-foreground">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="bg-transparent text-foreground focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          {/* Role */}
          <label className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2">
            <span className="text-[10px] uppercase text-muted-foreground">Role</span>
            <select
              value={roleId ?? ''}
              onChange={(e) => setRoleId(e.target.value || null)}
              className="bg-transparent text-foreground focus:outline-none"
              style={selectedRole ? { color: selectedRole.color } : undefined}
            >
              <option value="">No role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          {/* Estimate */}
          <label className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2">
            <span className="text-[10px] uppercase text-muted-foreground">Estimate</span>
            <input
              type="number"
              min={0}
              step={5}
              value={estimate ?? ''}
              onChange={(e) =>
                setEstimate(e.target.value === '' ? null : Number(e.target.value))
              }
              placeholder="minutes"
              className="bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/70"
            />
            {estimate !== null && estimate > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {formatMinutes(estimate)}
              </span>
            )}
          </label>

          {/* Scheduled date */}
          <label className="col-span-2 flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2">
            <span className="text-[10px] uppercase text-muted-foreground">Scheduled</span>
            <div className="flex items-center gap-2">
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
                  className="text-2xs text-muted-foreground/70 hover:text-foreground"
                >
                  unschedule
                </button>
              )}
            </div>
          </label>
        </div>

        {/* Meta row (read-only) */}
        <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-2xs text-muted-foreground">
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

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground/70">
            Esc to close · save commits edits
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-secondary text-sm transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || updateTask.isPending}
              className="px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-sm transition disabled:opacity-50"
            >
              {updateTask.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return body;
  return createPortal(body, document.body);
}

