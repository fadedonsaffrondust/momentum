import { Outlet } from 'react-router-dom';
import { useMe, useSettings } from '../api/hooks';
import { ToastStack } from '../components/ToastStack';
import { FirstRunWizard } from '../pages/FirstRunWizard';
import { ModalRoot } from '../modals/ModalRoot';
import { CommandPaletteModal } from '../modals/CommandPaletteModal';
import { AssigneePickerHost } from '../modals/AssigneePickerHost';
import { InvolvedPickerHost } from '../modals/InvolvedPickerHost';
import { TaskDetailModal } from '../modals/TaskDetailModal';
import { DataSync } from '../components/DataSync';
import { BackupReminder } from '../components/BackupReminder';
import { ShortcutsHint } from '../components/ShortcutsHint';
import { ConfirmProvider } from '../components/ConfirmModal';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GlobalCommands } from '@/lib/commands/global';
import { Sidebar } from './Sidebar';
import { useReleaseNotesPrompt } from '../hooks/useReleaseNotesPrompt';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';

export function AppShell() {
  const meQ = useMe();
  const settingsQ = useSettings();

  // Register app-wide keyboard shortcuts — fires on every view, including
  // pages that don't call `useKeyboardController`.
  useGlobalShortcuts();

  // Auto-open release notes once per new version, after onboarding.
  useReleaseNotesPrompt(settingsQ.data?.onboarded === true);

  if (settingsQ.isLoading || meQ.isLoading) {
    return (
      <div className="h-screen w-screen bg-background">
        <div className="h-full w-full animate-pulse bg-card/40" />
      </div>
    );
  }

  if (settingsQ.data && !settingsQ.data.onboarded) {
    return <FirstRunWizard />;
  }

  const theme = settingsQ.data?.theme ?? 'dark';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    // shadcn primitives read `.dark` on <html>; mirror it.
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={100}>
      <div className="h-screen flex bg-background text-foreground font-sans overflow-hidden">
        <Sidebar />

        <main className="flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </main>

        <ToastStack />
        <ModalRoot />
        <CommandPaletteModal />
        <AssigneePickerHost />
        <InvolvedPickerHost />
        <TaskDetailModal />
        <DataSync />
        <BackupReminder />
        <ShortcutsHint />
        <ConfirmProvider />
        <GlobalCommands />
      </div>
    </TooltipProvider>
  );
}
