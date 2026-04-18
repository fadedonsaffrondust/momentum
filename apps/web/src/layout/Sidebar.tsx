import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ShoppingBag } from 'lucide-react';
import { useInboxUnreadCount, useMe, useSettings, useUpdateSettings } from '../api/hooks';
import { useAuthStore } from '../store/auth';
import { useUiStore } from '../store/ui';
import { LATEST_VERSION } from '../lib/releaseNotes';
import { useHasUnseenRelease } from '../hooks/useReleaseNotesPrompt';
import { Avatar } from '../components/Avatar';

type IconProps = { className?: string };

const TasksIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="m8 12 3 3 5-6" />
  </svg>
);

const ParkingsIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const TeamIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const BrandsIcon = ({ className }: IconProps) => (
  <ShoppingBag size={18} className={className} />
);

const InboxIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
  </svg>
);

const SparkleIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m12 3-1.9 5.8L4 10l6.1 2 1.9 5.8 1.9-5.8L20 10l-6.1-1.9L12 3Z" />
    <path d="M5 21v-4" />
    <path d="M19 17v-4" />
  </svg>
);

const KeyboardIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h0" />
    <path d="M10 10h0" />
    <path d="M14 10h0" />
    <path d="M18 10h0" />
    <path d="M7 14h10" />
  </svg>
);

const SunIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SignOutIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: React.ComponentType<IconProps>;
  /** Extra pathnames that also count as active for this item. */
  matchPaths?: string[];
  /**
   * Numeric badge shown at the top-right of the icon. 0 or undefined
   * hides the badge; > 99 displays as "99+".
   */
  badgeCount?: number;
}

function SidebarNavItem({ to, label, icon: Icon, matchPaths, badgeCount }: SidebarNavItemProps) {
  const location = useLocation();
  const isActive =
    location.pathname === to ||
    location.pathname.startsWith(to + '/') ||
    (matchPaths?.includes(location.pathname) ?? false);

  return (
    <NavLink
      to={to}
      className="group relative flex items-center justify-center w-full py-3"
      aria-label={badgeCount ? `${label} (${badgeCount} unread)` : label}
      title={label}
    >
      <span
        className={clsx(
          'absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[2px] rounded-r transition-all',
          isActive ? 'bg-accent opacity-100' : 'opacity-0 group-hover:opacity-40 bg-m-fg-dim',
        )}
      />
      <span
        className={clsx(
          'relative flex items-center justify-center w-9 h-9 rounded-lg transition',
          isActive
            ? 'text-accent bg-accent/10'
            : 'text-m-fg-muted group-hover:text-m-fg-strong group-hover:bg-m-surface-60',
        )}
      >
        <Icon />
        {badgeCount !== undefined && badgeCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[9px] font-semibold text-white flex items-center justify-center leading-none font-mono"
            aria-hidden="true"
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </span>
      <span className="pointer-events-none absolute left-[58px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 px-2 py-1 rounded-md border border-m-border bg-m-bg text-[11px] text-m-fg-strong whitespace-nowrap shadow-lg z-50">
        {label}
      </span>
    </NavLink>
  );
}

interface SidebarIconButtonProps {
  onClick: () => void;
  label: string;
  icon: React.ComponentType<IconProps>;
  badge?: boolean;
}

function SidebarIconButton({ onClick, label, icon: Icon, badge }: SidebarIconButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center justify-center w-full py-2"
      aria-label={label}
      title={label}
    >
      <span className="relative flex items-center justify-center w-9 h-9 rounded-lg text-m-fg-muted hover:text-m-fg-strong hover:bg-m-surface-60 transition">
        <Icon />
        {badge && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        )}
      </span>
      <span className="pointer-events-none absolute left-[58px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 px-2 py-1 rounded-md border border-m-border bg-m-bg text-[11px] text-m-fg-strong whitespace-nowrap shadow-lg z-50">
        {label}
      </span>
    </button>
  );
}

export function Sidebar() {
  const meQ = useMe();
  const settingsQ = useSettings();
  const unreadQ = useInboxUnreadCount();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const updateSettings = useUpdateSettings();
  const openModal = useUiStore((s) => s.openModal);
  const hasUnseenRelease = useHasUnseenRelease();

  const theme = settingsQ.data?.theme ?? 'dark';
  const toggleTheme = () => {
    updateSettings.mutate({ theme: theme === 'dark' ? 'light' : 'dark' });
  };

  const unreadCount = unreadQ.data?.count ?? 0;

  return (
    <aside className="hidden md:flex w-[56px] flex-col shrink-0 items-center border-r border-m-border-subtle bg-m-bg/80 backdrop-blur h-full">
      {/* Logo mark */}
      <div className="py-4" title={`Momentum v${LATEST_VERSION}`}>
        <div className="w-8 h-8 rounded-lg border border-accent/40 bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
          M
        </div>
      </div>

      {/* Main nav — order matches VIEW_CYCLE in useGlobalShortcuts */}
      <nav className="flex-1 w-full flex flex-col items-center pt-2 gap-1">
        <SidebarNavItem to="/" label="Tasks" icon={TasksIcon} matchPaths={['/backlog']} />
        <SidebarNavItem to="/parkings" label="Parkings" icon={ParkingsIcon} />
        <SidebarNavItem to="/team" label="Team" icon={TeamIcon} />
        <SidebarNavItem to="/brands" label="Brands" icon={BrandsIcon} />
      </nav>

      {/* Bottom actions */}
      <div className="w-full flex flex-col items-center pb-2 border-t border-m-border-subtle pt-2">
        <SidebarNavItem
          to="/inbox"
          label="Inbox"
          icon={InboxIcon}
          badgeCount={unreadCount}
        />
        <SidebarIconButton
          onClick={() => openModal('release-notes')}
          label="What's new"
          icon={SparkleIcon}
          badge={hasUnseenRelease}
        />
        <SidebarIconButton
          onClick={() => openModal('shortcuts')}
          label="Shortcuts (?)"
          icon={KeyboardIcon}
        />
        <SidebarIconButton
          onClick={toggleTheme}
          label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          icon={theme === 'dark' ? SunIcon : MoonIcon}
        />
        <SidebarIconButton
          onClick={() => clearAuth()}
          label="Sign out"
          icon={SignOutIcon}
        />

        {/* Current user avatar — click opens settings modal. Shows the
            user's own colored avatar with displayName/email in tooltip. */}
        {meQ.data && (
          <div className="mt-2 group relative">
            <Avatar
              user={meQ.data}
              size="md"
              onClick={() => openModal('settings')}
            />
            <span className="pointer-events-none absolute left-[46px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 px-2 py-1 rounded-md border border-m-border bg-m-bg text-[11px] whitespace-nowrap shadow-lg z-50">
              <div className="text-m-fg-strong">{meQ.data.displayName || 'Set a name'}</div>
              <div className="text-m-fg-muted text-[10px]">{meQ.data.email}</div>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
