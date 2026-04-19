import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMe, useSettings, useUpdateMe, useUpdateSettings } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { useUiStore } from '../store/ui';

/**
 * Lightweight inline settings modal (spec §9.2). Opened from the
 * bottom-left user avatar in the sidebar. Three things the user can
 * change without leaving the shell: their displayName (team-wide
 * identity), their daily focus hours, and the dark/light theme.
 *
 * The avatarColor is deterministic and server-assigned, shown read-only
 * as a preview so the user understands why their avatar is that color.
 */
export function SettingsModal() {
  const close = useUiStore((s) => s.closeModal);
  const meQ = useMe();
  const settingsQ = useSettings();
  const updateMe = useUpdateMe();
  const updateSettings = useUpdateSettings();

  const [displayName, setDisplayName] = useState(meQ.data?.displayName ?? '');
  const [capacityHours, setCapacityHours] = useState(
    Math.round((settingsQ.data?.dailyCapacityMinutes ?? 480) / 60),
  );

  // Re-sync when the data loads (modal may open before hooks resolve).
  useEffect(() => {
    if (meQ.data?.displayName !== undefined) setDisplayName(meQ.data.displayName);
  }, [meQ.data?.displayName]);

  useEffect(() => {
    if (settingsQ.data?.dailyCapacityMinutes !== undefined) {
      setCapacityHours(Math.round(settingsQ.data.dailyCapacityMinutes / 60));
    }
  }, [settingsQ.data?.dailyCapacityMinutes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [close]);

  const theme = settingsQ.data?.theme ?? 'dark';

  const nameDirty = meQ.data ? displayName.trim() !== meQ.data.displayName : false;
  const capacityDirty = settingsQ.data
    ? capacityHours * 60 !== settingsQ.data.dailyCapacityMinutes
    : false;
  const dirty = nameDirty || capacityDirty;

  const save = async () => {
    const jobs: Promise<unknown>[] = [];
    if (nameDirty && displayName.trim().length > 0) {
      jobs.push(updateMe.mutateAsync({ displayName: displayName.trim() }));
    }
    if (capacityDirty) {
      jobs.push(updateSettings.mutateAsync({ dailyCapacityMinutes: capacityHours * 60 }));
    }
    await Promise.all(jobs);
    close();
  };

  const toggleTheme = () => {
    updateSettings.mutate({ theme: theme === 'dark' ? 'light' : 'dark' });
  };

  const loading = meQ.isLoading || settingsQ.isLoading;

  const body = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl p-5 animate-scaleIn">
        <header className="flex items-center gap-3 mb-5">
          {meQ.data && <Avatar user={meQ.data} size="md" showTooltip={false} />}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Settings
            </div>
            <div className="text-sm text-foreground truncate">{meQ.data?.email ?? '—'}</div>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5">
            <label className="block text-sm">
              <span className="text-muted-foreground">Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={64}
                autoFocus
                className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:border-primary"
              />
              <span className="mt-1 block text-2xs text-muted-foreground">
                Your teammates see this on tasks, parkings, and inbox events.
              </span>
            </label>

            <label className="block text-sm">
              <span className="text-muted-foreground">Daily capacity — {capacityHours}h</span>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={capacityHours}
                onChange={(e) => setCapacityHours(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
              />
            </label>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Theme</span>
              <button
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-md border border-border hover:bg-card/60 text-xs"
              >
                {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              </button>
            </div>

            {(updateMe.isError || updateSettings.isError) && (
              <p className="text-xs text-red-400">Save failed. Try again.</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={close}
                className="flex-1 py-2 rounded-md border border-border hover:bg-secondary text-sm transition"
              >
                Close
              </button>
              <button
                onClick={save}
                disabled={!dirty || updateMe.isPending || updateSettings.isPending}
                className="flex-1 py-2 rounded-md bg-primary hover:bg-primary/90 text-sm transition disabled:opacity-50"
              >
                {updateMe.isPending || updateSettings.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return body;
  return createPortal(body, document.body);
}
