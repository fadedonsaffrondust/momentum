import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../store/ui';
import { useUpdateSettings, useSettings } from '../api/hooks';

export function CommandPaletteModal() {
  const close = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);
  const navigate = useNavigate();
  const settingsQ = useSettings();
  const updateSettings = useUpdateSettings();

  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  const toggleTheme = () => {
    const theme = settingsQ.data?.theme === 'dark' ? 'light' : 'dark';
    updateSettings.mutate({ theme });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <Command
        label="Command Palette"
        className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
      >
        <Command.Input
          autoFocus
          placeholder="Type a command…"
          className="w-full px-4 py-3 bg-transparent border-b border-zinc-900 text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto py-2">
          <Command.Empty className="px-4 py-6 text-center text-sm text-zinc-500">
            No commands match.
          </Command.Empty>

          <Command.Group heading="Daily">
            <Command.Item onSelect={run(() => openModal('plan-my-day'))}>
              Plan My Day
            </Command.Item>
            <Command.Item onSelect={run(() => openModal('end-of-day'))}>
              End of Day Review
            </Command.Item>
            <Command.Item onSelect={run(() => openModal('weekly-stats'))}>
              Weekly Stats
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Navigation">
            <Command.Item onSelect={run(() => navigate('/'))}>Go to Today</Command.Item>
            <Command.Item onSelect={run(() => navigate('/backlog'))}>
              Go to Backlog
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Data">
            <Command.Item
              onSelect={run(() => window.dispatchEvent(new CustomEvent('momentum:export')))}
            >
              Export Data (JSON)
            </Command.Item>
            <Command.Item
              onSelect={run(() => window.dispatchEvent(new CustomEvent('momentum:import')))}
            >
              Import Data (JSON)
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Preferences">
            <Command.Item onSelect={run(toggleTheme)}>Toggle Dark Mode</Command.Item>
          </Command.Group>

          <Command.Group heading="Help">
            <Command.Item onSelect={run(() => openModal('shortcuts'))}>
              Keyboard Shortcuts
            </Command.Item>
            <Command.Item onSelect={run(() => openModal('release-notes'))}>
              What's New
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
