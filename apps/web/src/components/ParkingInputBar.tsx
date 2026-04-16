import { forwardRef, useState } from 'react';
import { parseQuickAdd, resolveDateToken } from '@momentum/shared';
import { useCreateParking, useRoles } from '../api/hooks';
import { useUiStore } from '../store/ui';
import { tomorrowIso } from '../lib/date';

export const ParkingInputBar = forwardRef<HTMLInputElement>((_props, ref) => {
  const [value, setValue] = useState('');
  const createParking = useCreateParking();
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

    // Parkings default to tomorrow's daily when no date token is present —
    // that's usually the one you're prepping for.
    const targetDate = parsed.dateToken
      ? (resolveDateToken(parsed.dateToken) ?? tomorrowIso())
      : tomorrowIso();

    try {
      await createParking.mutateAsync({
        title: parsed.title,
        roleId,
        priority: parsed.priority ?? 'medium',
        targetDate,
      });
      setValue('');
    } catch (err) {
      pushToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to add parking',
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
        placeholder="Park a topic for the next daily… (#role for context, !h for priority, +mon to target a specific daily)"
        className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-lg focus:outline-none focus:border-accent text-zinc-100 placeholder:text-zinc-600"
      />
    </form>
  );
});
ParkingInputBar.displayName = 'ParkingInputBar';
