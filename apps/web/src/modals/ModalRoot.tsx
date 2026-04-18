import { useUiStore } from '../store/ui';
import { CommandPaletteModal } from './CommandPaletteModal';
import { PlanMyDayModal } from './PlanMyDayModal';
import { EndOfDayModal } from './EndOfDayModal';
import { WeeklyStatsModal } from './WeeklyStatsModal';
import { ShortcutsModal } from './ShortcutsModal';
import { ImportConfirmModal } from './ImportConfirmModal';
import { RolePickerModal } from './RolePickerModal';
import { ReleaseNotesModal } from './ReleaseNotesModal';
import { SettingsModal } from './SettingsModal';

export function ModalRoot() {
  const active = useUiStore((s) => s.activeModal);
  if (!active) return null;
  switch (active) {
    case 'command-palette':
      return <CommandPaletteModal />;
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
