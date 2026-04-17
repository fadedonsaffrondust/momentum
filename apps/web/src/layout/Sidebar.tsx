import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ShoppingBag } from 'lucide-react';
import { useSettings, useUpdateSettings } from '../api/hooks';
import { useAuthStore } from '../store/auth';
import { useUiStore } from '../store/ui';
import { LATEST_VERSION } from '../lib/releaseNotes';
import { useHasUnseenRelease } from '../hooks/useReleaseNotesPrompt';

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

const BrandsIcon = ({ className }: IconProps) => (
  <ShoppingBag size={18} className={className} />
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
}

function SidebarNavItem({ to, label, icon: Icon, matchPaths }: SidebarNavItemProps) {
  const location = useLocation();
  const isActive =
    location.pathname === to ||
    location.pathname.startsWith(to + '/') ||
    (matchPaths?.includes(location.pathname) ?? false);

  return (
    <NavLink
      to={to}
      className="group relative flex items-center justify-center w-full py-3"
      aria-label={label}
      title={label}
    >
      {/* Active accent bar on the left edge */}
      <span
        className={clsx(
          'absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[2px] rounded-r transition-all',
          isActive ? 'bg-accent opacity-100' : 'opacity-0 group-hover:opacity-40 bg-m-fg-dim',
        )}
      />
      <span
        className={clsx(
          'flex items-center justify-center w-9 h-9 rounded-lg transition',
          isActive
            ? 'text-accent bg-accent/10'
            : 'text-m-fg-muted group-hover:text-m-fg-strong group-hover:bg-m-surface-60',
        )}
      >
        <Icon />
      </span>
      {/* Tooltip */}
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
  const settingsQ = useSettings();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const updateSettings = useUpdateSettings();
  const openModal = useUiStore((s) => s.openModal);
  const hasUnseenRelease = useHasUnseenRelease();

  const theme = settingsQ.data?.theme ?? 'dark';
  const toggleTheme = () => {
    updateSettings.mutate({ theme: theme === 'dark' ? 'light' : 'dark' });
  };

  const userInitial = (settingsQ.data?.userName ?? '?').slice(0, 1).toUpperCase();

  return (
    <aside className="hidden md:flex w-[56px] flex-col shrink-0 items-center border-r border-m-border-subtle bg-m-bg/80 backdrop-blur h-full">
      {/* Logo mark */}
      <div className="py-4" title={`Momentum v${LATEST_VERSION}`}>
        <div className="w-8 h-8 rounded-lg border border-accent/40 bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
          M
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 w-full flex flex-col items-center pt-2 gap-1">
        <SidebarNavItem to="/" label="Tasks" icon={TasksIcon} matchPaths={['/backlog']} />
        <SidebarNavItem to="/parkings" label="Parkings" icon={ParkingsIcon} />
        <SidebarNavItem to="/brands" label="Brands" icon={BrandsIcon} matchPaths={[]} />
      </nav>

      {/* Bottom actions */}
      <div className="w-full flex flex-col items-center pb-2 border-t border-m-border-subtle pt-2">
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

        {/* User avatar */}
        <div
          className="mt-2 w-8 h-8 rounded-full border border-m-border bg-m-surface flex items-center justify-center text-[11px] text-m-fg-secondary"
          title={settingsQ.data?.userName ?? ''}
        >
          {userInitial}
        </div>
      </div>
    </aside>
  );
}
