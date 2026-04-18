import { useUiStore } from '../store/ui';
import { PlanMyDayModal } from './PlanMyDayModal';
import { EndOfDayModal } from './EndOfDayModal';
import { WeeklyStatsModal } from './WeeklyStatsModal';
import { ShortcutsModal } from './ShortcutsModal';
import { ImportConfirmModal } from './ImportConfirmModal';
import { RolePickerModal } from './RolePickerModal';
import { ReleaseNotesModal } from './ReleaseNotesModal';
import { SettingsModal } from './SettingsModal';

/**
 * Renders the legacy modal for the currently active modal kind.
 * The command palette is mounted unconditionally in `AppShell` because
 * its Radix Dialog lifecycle needs to stay attached to drive enter/exit
 * animations.
 */
export function ModalRoot() {
  const active = useUiStore((s) => s.activeModal);
  if (!active) return null;
  switch (active) {
    case 'command-palette':
      return null;
    case 'plan-my-day':
      return <PlanMyDayModal />;
    case 'end-of-day':
      return <EndOfDayModal />;
    case 'weekly-stats':
      return <WeeklyStatsModal />;
    case 'shortcuts':
      return <ShortcutsModal />;
    case 'import-confirm':
      return <ImportConfirmModal />;
    case 'role-picker':
      return <RolePickerModal />;
    case 'release-notes':
      return <ReleaseNotesModal />;
    case 'settings':
      return <SettingsModal />;
    default:
      return null;
  }
}
