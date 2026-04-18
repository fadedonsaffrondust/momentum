import { Outlet } from 'react-router-dom';
import { useMe, useSettings } from '../api/hooks';
import { ToastStack } from '../components/ToastStack';
import { FirstRunWizard } from '../pages/FirstRunWizard';
import { ModalRoot } from '../modals/ModalRoot';
import { AssigneePickerHost } from '../modals/AssigneePickerHost';
import { InvolvedPickerHost } from '../modals/InvolvedPickerHost';
import { TaskDetailModal } from '../modals/TaskDetailModal';
import { DataSync } from '../components/DataSync';
import { BackupReminder } from '../components/BackupReminder';
import { ShortcutsHint } from '../components/ShortcutsHint';
import { ConfirmProvider } from '../components/ConfirmModal';
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
      <div className="min-h-screen flex items-center justify-center text-m-fg-muted">
        Loading…
      </div>
    );
  }

  if (settingsQ.data && !settingsQ.data.onboarded) {
    return <FirstRunWizard />;
  }

  const theme = settingsQ.data?.theme ?? 'dark';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }

  return (
    <div className="h-screen flex bg-m-bg text-m-fg font-mono overflow-hidden">
      <Sidebar />

      <main className="flex-1 min-w-0 overflow-hidden">
        <Outlet />
      </main>

      <ToastStack />
      <ModalRoot />
      <AssigneePickerHost />
      <InvolvedPickerHost />
      <TaskDetailModal />
      <DataSync />
      <BackupReminder />
      <ShortcutsHint />
      <ConfirmProvider />
    </div>
  );
}
