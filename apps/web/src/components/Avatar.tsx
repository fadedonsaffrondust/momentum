import clsx from 'clsx';
import type { UserSummary } from '@momentum/shared';

export type AvatarSize = 'xs' | 'sm' | 'md';

/**
 * Subset of UserSummary needed to render an avatar. `deactivatedAt` is
 * optional so `AuthUser` (from /auth/me — always an active user by
 * definition) can be rendered without being fake-widened first.
 */
export type AvatarUser = Pick<UserSummary, 'id' | 'email' | 'displayName' | 'avatarColor'> & {
  deactivatedAt?: UserSummary['deactivatedAt'];
};

interface Props {
  user: AvatarUser;
  size?: AvatarSize;
  /** Show the user's displayName + email as a browser-native title tooltip. */
  showTooltip?: boolean;
  /** Optional click handler — when present the avatar renders as a button. */
  onClick?: () => void;
  className?: string;
}

/**
 * Colored circle with the user's initials. Deactivated users render grey
 * with reduced opacity and a "(deactivated)" suffix in the tooltip so
 * historical avatars (e.g., in old brand events) still identify correctly.
 */
export function Avatar({ user, size = 'sm', showTooltip = true, onClick, className }: Props) {
  const initials = getInitials(user);
  const deactivated = user.deactivatedAt !== null && user.deactivatedAt !== undefined;
  const tooltip = showTooltip
    ? `${user.displayName || user.email}${deactivated ? ' (deactivated)' : ''}`
    : undefined;

  const style = deactivated
    ? undefined
    : { backgroundColor: user.avatarColor, color: readableTextColor(user.avatarColor) };

  const baseClasses = clsx(
    'inline-flex items-center justify-center rounded-full font-mono font-semibold select-none shrink-0',
    SIZE_CLASSES[size],
    deactivated
      ? 'bg-m-surface-raised text-m-fg-muted opacity-60'
      : '',
    onClick ? 'cursor-pointer hover:ring-2 hover:ring-accent/40 transition' : '',
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        title={tooltip}
        aria-label={tooltip ?? user.displayName ?? user.email}
        onClick={onClick}
        className={baseClasses}
        style={style}
        data-deactivated={deactivated || undefined}
      >
        {initials}
      </button>
    );
  }

  return (
    <span
      title={tooltip}
      aria-label={tooltip ?? user.displayName ?? user.email}
      className={baseClasses}
      style={style}
      data-deactivated={deactivated || undefined}
    >
      {initials}
    </span>
  );
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-4 h-4 text-[8px]',
  sm: 'w-5 h-5 text-[9px]',
  md: 'w-8 h-8 text-[11px]',
};

/**
 * Initials: first letter of first word + first letter of last word.
 * If displayName is empty or whitespace, fall back to the first two
 * letters of the email local-part. All output upper-cased.
 */
export function getInitials(user: Pick<UserSummary, 'displayName' | 'email'>): string {
  const name = user.displayName.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    const first = parts[0]!;
    const last = parts[parts.length - 1]!;
    return (first[0]! + last[0]!).toUpperCase();
  }
  const local = user.email.split('@')[0] ?? '';
  return (local.slice(0, 2) || '??').toUpperCase();
}

/**
 * Pick black or white text depending on the background hex's relative
 * luminance. Uses the WCAG-ish formula — good enough for 8 palette colors.
 */
function readableTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#000000';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}
