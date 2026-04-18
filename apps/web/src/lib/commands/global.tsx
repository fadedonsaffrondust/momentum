import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Moon,
  Sun,
  BarChart3,
  Home,
  ListTodo,
  Pin,
  Users,
  ShoppingBag,
  Inbox,
  Download,
  Upload,
  Keyboard,
  Sparkles,
  Settings,
  LogOut,
} from 'lucide-react';
import { useUiStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { useSettings, useUpdateSettings } from '@/api/hooks';
import { useRegisterCommands } from '@/lib/commands/context';
import type { Command } from '@/lib/commands/types';

/**
 * Registers Momentum's global commands. Mounted once from `<AppShell>`.
 * Every command is visible from every route (no `when` predicate).
 */
export function GlobalCommands(): null {
  const navigate = useNavigate();
  const openModal = useUiStore((s) => s.openModal);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const settingsQ = useSettings();
  const updateSettings = useUpdateSettings();

  const theme = settingsQ.data?.theme ?? 'dark';

  const commands = useMemo<readonly Command[]>(
    () => [
      // Daily rituals
      {
        id: 'plan-my-day',
        label: 'Plan My Day',
        description: 'Start the morning planning ritual',
        icon: Calendar,
        shortcut: 'Cmd P',
        section: 'Daily',
        priority: 100,
        run: () => openModal('plan-my-day'),
      },
      {
        id: 'end-of-day',
        label: 'End of Day Review',
        description: 'Reflect on what shipped and what rolls over',
        icon: Moon,
        shortcut: 'Cmd R',
        section: 'Daily',
        priority: 90,
        run: () => openModal('end-of-day'),
      },
      {
        id: 'weekly-stats',
        label: 'Weekly Stats',
        description: 'Review this week at a glance',
        icon: BarChart3,
        shortcut: 'Cmd W',
        section: 'Daily',
        priority: 80,
        run: () => openModal('weekly-stats'),
      },

      // Navigation
      {
        id: 'go-today',
        label: 'Go to Today',
        icon: Home,
        shortcut: 'g t',
        section: 'Navigate',
        priority: 100,
        run: () => navigate('/'),
      },
      {
        id: 'go-backlog',
        label: 'Go to Backlog',
        icon: ListTodo,
        shortcut: 'g l',
        section: 'Navigate',
        priority: 90,
        run: () => navigate('/backlog'),
      },
      {
        id: 'go-parkings',
        label: 'Go to Parkings',
        icon: Pin,
        shortcut: 'g p',
        section: 'Navigate',
        priority: 80,
        run: () => navigate('/parkings'),
      },
      {
        id: 'go-team',
        label: 'Go to Team',
        icon: Users,
        shortcut: 'g u',
        section: 'Navigate',
        priority: 70,
        run: () => navigate('/team'),
      },
      {
        id: 'go-brands',
        label: 'Go to Brands',
        icon: ShoppingBag,
        shortcut: 'g b',
        section: 'Navigate',
        priority: 60,
        run: () => navigate('/brands'),
      },
      {
        id: 'go-inbox',
        label: 'Go to Inbox',
        icon: Inbox,
        shortcut: 'g i',
        section: 'Navigate',
        priority: 50,
        run: () => navigate('/inbox'),
      },

      // Data
      {
        id: 'export-data',
        label: 'Export data',
        description: 'Download your workspace as a JSON backup',
        icon: Download,
        shortcut: 'Cmd E',
        section: 'Data',
        priority: 20,
        run: () => window.dispatchEvent(new CustomEvent('momentum:export')),
      },
      {
        id: 'import-data',
        label: 'Import data',
        description: 'Restore from a JSON backup',
        icon: Upload,
        shortcut: 'Cmd I',
        section: 'Data',
        priority: 10,
        run: () => window.dispatchEvent(new CustomEvent('momentum:import')),
      },

      // Preferences
      {
        id: 'toggle-theme',
        label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        icon: theme === 'dark' ? Sun : Moon,
        section: 'Preferences',
        priority: 30,
        run: () =>
          updateSettings.mutate({ theme: theme === 'dark' ? 'light' : 'dark' }),
      },
      {
        id: 'open-settings',
        label: 'Open settings',
        icon: Settings,
        section: 'Preferences',
        priority: 20,
        run: () => openModal('settings'),
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        icon: LogOut,
        section: 'Preferences',
        priority: 10,
        run: () => clearAuth(),
      },

      // Help
      {
        id: 'open-shortcuts',
        label: 'Keyboard shortcuts',
        icon: Keyboard,
        shortcut: '?',
        section: 'Help',
        priority: 20,
        run: () => openModal('shortcuts'),
      },
      {
        id: 'whats-new',
        label: "What's new",
        description: 'Release notes for recent versions',
        icon: Sparkles,
        section: 'Help',
        priority: 10,
        run: () => openModal('release-notes'),
      },
    ],
    [navigate, openModal, clearAuth, theme, updateSettings],
  );

  useRegisterCommands(commands, [commands]);
  return null;
}
