import { forwardRef, useState } from 'react';
import type { ParkingVisibility } from '@momentum/shared';
import { parseQuickAdd, resolveDateToken } from '@momentum/shared';
import { useCreateParking, useRoles } from '../api/hooks';
import { useUiStore } from '../store/ui';
import { tomorrowIso } from '../lib/date';

export const ParkingInputBar = forwardRef<HTMLInputElement>((_props, ref) => {
  const [value, setValue] = useState('');
  const [visibility, setVisibility] = useState<ParkingVisibility>('team');
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

    const targetDate = parsed.dateToken
      ? (resolveDateToken(parsed.dateToken) ?? tomorrowIso())
      : tomorrowIso();

    try {
      await createParking.mutateAsync({
        title: parsed.title,
        roleId,
        priority: parsed.priority ?? 'medium',
        targetDate,
        visibility,
      });
      setValue('');
      // Sticky private — if the user intentionally toggled private for
      // one note they probably want the next one private too. Reset
      // isn't assumed here. Flip back via the toggle when done.
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
      <div className="flex items-stretch gap-2">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-task-input="true"
          placeholder={
            visibility === 'private'
              ? 'Park a private topic (only you can see it)…'
              : 'Park a topic for the next daily… (#role, !h, +mon)'
          }
          className="flex-1 px-4 py-3 bg-m-surface-60 border border-m-border rounded-lg focus:outline-none focus:border-accent text-m-fg placeholder:text-m-fg-dim"
        />
        <button
          type="button"
          onClick={() =>
            setVisibility((v) => (v === 'team' ? 'private' : 'team'))
          }
          title={
            visibility === 'private'
              ? 'Private — only you see this parking'
              : 'Team — everyone sees this parking'
          }
          aria-label={
            visibility === 'private' ? 'Make team-visible' : 'Make private'
          }
          className="shrink-0 px-3 rounded-lg border border-m-border bg-m-surface-60 text-m-fg-muted hover:text-m-fg-strong hover:border-m-border-strong transition flex items-center gap-1.5 text-xs"
        >
          {visibility === 'private' ? <LockIcon /> : <TeamIcon />}
          <span>{visibility === 'private' ? 'Private' : 'Team'}</span>
        </button>
      </div>
    </form>
  );
});
ParkingInputBar.displayName = 'ParkingInputBar';

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
