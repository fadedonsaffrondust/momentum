import { forwardRef, useMemo, useState } from 'react';
import { parseQuickAdd, resolveAssigneeToken, resolveDateToken } from '@momentum/shared';
import { useCreateTask, useRoles, useUsers } from '../api/hooks';
import { useUiStore } from '../store/ui';
import { todayIso } from '../lib/date';
import { Avatar } from './Avatar';

export const TaskInputBar = forwardRef<HTMLInputElement>((_props, ref) => {
  const [value, setValue] = useState('');
  const createTask = useCreateTask();
  const rolesQ = useRoles();
  const usersQ = useUsers();
  const pushToast = useUiStore((s) => s.pushToast);
  const roleFilter = useUiStore((s) => s.roleFilter);

  const users = usersQ.data ?? [];

  // Live parse so the preview chip matches whatever the user sees. If the
  // @token doesn't resolve to a teammate we render nothing — the token
  // will stay in the title on submit, matching spec §9.3's "fallback".
  const parsed = useMemo(() => parseQuickAdd(value), [value]);
  const resolvedAssigneeId = useMemo(
    () => resolveAssigneeToken(parsed.assigneeToken, users),
    [parsed.assigneeToken, users],
  );
  const resolvedAssignee = useMemo(
    () => (resolvedAssigneeId ? users.find((u) => u.id === resolvedAssigneeId) : undefined),
    [resolvedAssigneeId, users],
  );

  const submit = async () => {
    const input = value.trim();
    if (!input) return;

    const p = parseQuickAdd(input);
    const assigneeId = resolveAssigneeToken(p.assigneeToken, users);

    // Unmatched @foo tokens re-inject into the title so the user still
    // sees their literal input preserved. Matched tokens are already
    // stripped by the parser.
    const finalTitle =
      p.assigneeToken && !assigneeId
        ? `${p.title} @${p.assigneeToken}`.trim()
        : p.title;
    if (!finalTitle) return;

    const roles = rolesQ.data ?? [];
    const roleIdFromTag = p.roleTag
      ? (roles.find((r) => r.name.toLowerCase() === p.roleTag)?.id ?? null)
      : null;
    const roleId = roleIdFromTag ?? roleFilter ?? null;

    const scheduledDate = p.dateToken
      ? (resolveDateToken(p.dateToken) ?? todayIso())
      : todayIso();

    try {
      await createTask.mutateAsync({
        title: finalTitle,
        estimateMinutes: p.estimateMinutes,
        roleId,
        priority: p.priority ?? 'medium',
        scheduledDate,
        ...(assigneeId ? { assigneeId } : {}),
      });
      setValue('');
    } catch (err) {
      pushToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to add task',
        durationMs: 4000,
      });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="w-full"
    >
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        data-task-input="true"
        placeholder="Type a task… (~30m for time, #role for context, !h for priority, +tomorrow, @teammate to assign)"
        className="w-full px-4 py-3 bg-m-surface-60 border border-m-border rounded-lg focus:outline-none focus:border-accent text-m-fg placeholder:text-m-fg-dim"
      />

      {parsed.assigneeToken && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          {resolvedAssignee ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              <Avatar user={resolvedAssignee} size="xs" showTooltip={false} />
              <span>Assign to {resolvedAssignee.displayName || resolvedAssignee.email}</span>
            </span>
          ) : (
            <span className="text-m-fg-dim">
              @{parsed.assigneeToken} doesn't match any teammate — will stay in the title.
            </span>
          )}
        </div>
      )}
    </form>
  );
});
TaskInputBar.displayName = 'TaskInputBar';
