import clsx from 'clsx';
import { Avatar, type AvatarSize, type AvatarUser } from './Avatar';

interface Props {
  users: readonly AvatarUser[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}

/**
 * Overlapping-circle stack of avatars with an overflow chip `+N` when
 * the roster exceeds `max`. Used for parking `involvedIds[]` rendering
 * (spec §9.5) and brand-meeting attendees (spec §9.6).
 */
export function AvatarStack({ users, max = 4, size = 'xs', className }: Props) {
  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <span className={clsx('inline-flex items-center', className)}>
      {visible.map((u, i) => (
        <span
          key={u.id}
          className={clsx('relative inline-flex', i > 0 && '-ml-1.5')}
          style={{ zIndex: visible.length - i }}
        >
          <Avatar user={u} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={clsx(
            'inline-flex items-center justify-center rounded-full border border-m-border bg-m-surface text-m-fg-tertiary font-mono font-semibold select-none -ml-1.5',
            OVERFLOW_SIZE[size],
          )}
          title={`${overflow} more`}
          aria-label={`${overflow} more user${overflow === 1 ? '' : 's'}`}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

const OVERFLOW_SIZE: Record<AvatarSize, string> = {
  xs: 'w-4 h-4 text-[8px]',
  sm: 'w-5 h-5 text-[9px]',
  md: 'w-8 h-8 text-[10px]',
};
