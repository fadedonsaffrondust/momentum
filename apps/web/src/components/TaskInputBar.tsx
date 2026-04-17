import { forwardRef, useState } from 'react';
import { parseQuickAdd, resolveDateToken } from '@momentum/shared';
import { useCreateTask, useRoles } from '../api/hooks';
import { useUiStore } from '../store/ui';
import { todayIso } from '../lib/date';

export const TaskInputBar = forwardRef<HTMLInputElement>((_props, ref) => {
  const [value, setValue] = useState('');
  const createTask = useCreateTask();
  const rolesQ = useRoles();
  const pushToast = useUiStore((s) => s.pushToast);
  const roleFilter = useUiStore((s) => s.roleFilter);

  const submit = async () => {
    const input = value.trim();
    if (!input) return;

    const parsed = parseQuickAdd(input);
    if (!parsed.title) return;

    const roles = rolesQ.data ?? [];
    const roleIdFromTag = parsed.roleTag
      ? (roles.find((r) => r.name.toLowerCase() === parsed.roleTag)?.id ?? null)
      : null;
    const roleId = roleIdFromTag ?? roleFilter ?? null;

    const scheduledDate = parsed.dateToken
      ? (resolveDateToken(parsed.dateToken) ?? todayIso())
      : todayIso();

    try {
      await createTask.mutateAsync({
        title: parsed.title,
        estimateMinutes: parsed.estimateMinutes,
        roleId,
        priority: parsed.priority ?? 'medium',
        scheduledDate,
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
        placeholder="Type a task… (~30m for time, #role for context, !h for priority, +tomorrow to schedule)"
        className="w-full px-4 py-3 bg-m-surface-60 border border-m-border rounded-lg focus:outline-none focus:border-accent text-m-fg placeholder:text-m-fg-dim"
      />
    </form>
  );
});
TaskInputBar.displayName = 'TaskInputBar';
