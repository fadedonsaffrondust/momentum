import { NavLink, useLocation } from 'react-router-dom';
import {
  CheckSquare,
  CarFront,
  Users,
  ShoppingBag,
  Inbox,
  Sparkles,
  Keyboard,
  Sun,
  Moon,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import {
  useInboxUnreadCount,
  useMe,
  useSettings,
  useUpdateSettings,
} from '../api/hooks';
import { useAuthStore } from '../store/auth';
import { useUiStore } from '../store/ui';
import { LATEST_VERSION } from '../lib/releaseNotes';
import { useHasUnseenRelease } from '../hooks/useReleaseNotesPrompt';
import { Avatar } from '../components/Avatar';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';

function TooltipLabel({
  label,
  shortcut,
}: {
  label: string;
  shortcut?: string;
}) {
  if (!shortcut) return <span>{label}</span>;
  const tokens = shortcut.split(' ').filter(Boolean);
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <span className="inline-flex items-center gap-1">
        {tokens.map((t, i) => (
          <Kbd key={`${t}-${i}`} className="h-4 min-w-4 text-[10px]">
            {t}
          </Kbd>
        ))}
      </span>
    </span>
  );
}

interface SidebarNavItemProps {
  to: string;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  matchPaths?: readonly string[];
  badgeCount?: number;
}

function SidebarNavItem({
  to,
  label,
  shortcut,
  icon: Icon,
  matchPaths,
  badgeCount,
}: SidebarNavItemProps) {
  const location = useLocation();
  const isActive =
    location.pathname === to ||
    location.pathname.startsWith(to + '/') ||
    (matchPaths?.includes(location.pathname) ?? false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          className="group relative flex items-center justify-center w-full py-3"
          aria-label={
            badgeCount ? `${label} (${badgeCount} unread)` : label
          }
        >
          <span
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r transition-opacity duration-150',
              isActive
                ? 'bg-primary opacity-100'
                : 'bg-muted-foreground opacity-0 group-hover:opacity-40',
            )}
          />
          <span
            className={cn(
              'relative flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground group-hover:bg-secondary group-hover:text-foreground',
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {badgeCount !== undefined && badgeCount > 0 ? (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-none text-primary-foreground"
                aria-hidden="true"
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            ) : null}
          </span>
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <TooltipLabel label={label} shortcut={shortcut} />
      </TooltipContent>
    </Tooltip>
  );
}

interface SidebarIconButtonProps {
  onClick: () => void;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  badge?: boolean;
}

function SidebarIconButton({
  onClick,
  label,
  shortcut,
  icon: Icon,
  badge,
}: SidebarIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="group relative flex items-center justify-center w-full py-2 focus-visible:outline-none"
          aria-label={label}
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 group-hover:bg-secondary group-hover:text-foreground group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background">
            <Icon className="h-4 w-4" aria-hidden="true" />
            {badge ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            ) : null}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <TooltipLabel label={label} shortcut={shortcut} />
      </TooltipContent>
    </Tooltip>
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
    <aside className="hidden md:flex h-full w-14 flex-col items-center border-r border-border bg-card/80 backdrop-blur shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="py-4" role="img" aria-label={`Momentum v${LATEST_VERSION}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-sm font-semibold text-primary">
              M
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Momentum v{LATEST_VERSION}
        </TooltipContent>
      </Tooltip>

      <nav className="flex w-full flex-1 flex-col items-center gap-1 pt-2">
        <SidebarNavItem
          to="/"
          label="Tasks"
          shortcut="g t"
          icon={CheckSquare}
          matchPaths={['/backlog']}
        />
        <SidebarNavItem
          to="/parkings"
          label="Parkings"
          shortcut="g p"
          icon={CarFront}
        />
        <SidebarNavItem to="/team" label="Team" shortcut="g u" icon={Users} />
        <SidebarNavItem
          to="/brands"
          label="Brands"
          shortcut="g b"
          icon={ShoppingBag}
        />
      </nav>

      <div className="flex w-full flex-col items-center border-t border-border pt-2 pb-2">
        <SidebarNavItem
          to="/inbox"
          label="Inbox"
          shortcut="g i"
          icon={Inbox}
          badgeCount={unreadCount}
        />
        <SidebarIconButton
          onClick={() => openModal('release-notes')}
          label="What's new"
          icon={Sparkles}
          badge={hasUnseenRelease}
        />
        <SidebarIconButton
          onClick={() => openModal('shortcuts')}
          label="Shortcuts"
          shortcut="?"
          icon={Keyboard}
        />
        <SidebarIconButton
          onClick={toggleTheme}
          label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          icon={theme === 'dark' ? Sun : Moon}
        />
        <SidebarIconButton
          onClick={() => clearAuth()}
          label="Sign out"
          icon={LogOut}
        />

        {meQ.data ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-2">
                <Avatar
                  user={meQ.data}
                  size="md"
                  onClick={() => openModal('settings')}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <div className="flex flex-col">
                <span className="text-foreground">
                  {meQ.data.displayName || 'Set a name'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {meQ.data.email}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </aside>
  );
}
