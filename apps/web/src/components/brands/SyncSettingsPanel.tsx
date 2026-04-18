import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Brand, BrandStakeholder, SyncConfig } from '@momentum/shared';
import { useUpdateSyncConfig } from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  brand: Brand;
  stakeholders: BrandStakeholder[];
  onClose: () => void;
}

const WINDOW_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 14 days', value: 14 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

const MEETING_TYPE_OPTIONS = [
  { label: 'External only', value: 'external' as const },
  { label: 'Internal only', value: 'internal' as const },
  { label: 'Both', value: 'both' as const },
];

export function SyncSettingsPanel({ brand, stakeholders, onClose }: Props) {
  const syncConfig = brand.syncConfig as SyncConfig | null;
  const rules = syncConfig?.matchRules;

  const [titleKeywords, setTitleKeywords] = useState(
    rules?.titleKeywords?.join(', ') ?? '',
  );
  const [meetingType, setMeetingType] = useState<'external' | 'internal' | 'both'>(
    rules?.meetingType ?? 'external',
  );
  const [syncWindowDays, setSyncWindowDays] = useState(
    rules?.syncWindowDays ?? 30,
  );

  const updateConfig = useUpdateSyncConfig(brand.id);
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const stakeholderEmails = stakeholders
    .filter((s) => s.email)
    .map((s) => ({ name: s.name, email: s.email! }));
  const stakeholdersWithoutEmail = stakeholders.filter((s) => !s.email);

  const handleSave = () => {
    const keywords = titleKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    updateConfig.mutate(
      {
        matchRules: {
          titleKeywords: keywords,
          meetingType,
          syncWindowDays,
        },
      },
      {
        onSuccess: () => {
          pushToast({ kind: 'success', message: 'Sync settings saved', durationMs: 2000 });
          onClose();
        },
        onError: () => {
          pushToast({ kind: 'error', message: 'Failed to save sync settings', durationMs: 3000 });
        },
      },
    );
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-background border-l border-border shadow-2xl flex flex-col animate-slideLeft">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Recording Sync Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Stakeholder emails */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Stakeholder Emails for Matching
            </label>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-2">
              Meetings with these attendees score highest. Emails are pulled from your stakeholders.
            </p>
            {stakeholderEmails.length > 0 ? (
              <ul className="space-y-1">
                {stakeholderEmails.map((s) => (
                  <li
                    key={s.email}
                    className="flex items-center gap-2 px-2 py-1 rounded bg-card/50 text-xs"
                  >
                    <span className="text-foreground">{s.name}</span>
                    <span className="text-muted-foreground/70">{s.email}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/70 italic">No stakeholder emails configured.</p>
            )}

            {stakeholdersWithoutEmail.length > 0 && (
              <div className="flex items-start gap-2 mt-2 p-2 rounded bg-amber-500/5 border border-amber-500/20">
                <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-400/80">
                  {stakeholdersWithoutEmail.length} stakeholder{stakeholdersWithoutEmail.length > 1 ? 's' : ''} missing
                  email: {stakeholdersWithoutEmail.map((s) => s.name).join(', ')}.
                  Add emails in the North Star section for better matching.
                </p>
              </div>
            )}
          </div>

          {/* Title keywords */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Title Keywords
            </label>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-2">
              Comma-separated. Meetings whose titles contain these words will score higher.
            </p>
            <input
              type="text"
              value={titleKeywords}
              onChange={(e) => setTitleKeywords(e.target.value)}
              placeholder="e.g. Boudin, BNDN, Bakery"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/70"
            />
          </div>

          {/* Meeting type filter */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Meeting Type Filter
            </label>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-2">
              Filter which meetings to look for. Note: classification may not always be accurate.
            </p>
            <select
              value={meetingType}
              onChange={(e) =>
                setMeetingType(e.target.value as 'external' | 'internal' | 'both')
              }
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {MEETING_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sync window */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Sync Window
            </label>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-2">
              How far back to look for recordings on the first sync.
            </p>
            <select
              value={syncWindowDays}
              onChange={(e) => setSyncWindowDays(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {WINDOW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Last sync info */}
          {syncConfig?.lastSyncedAt && (
            <div className="text-xs text-muted-foreground/70">
              Last synced: {new Date(syncConfig.lastSyncedAt).toLocaleString()}
              {syncConfig.syncedMeetingIds.length > 0 && (
                <span className="ml-1">
                  ({syncConfig.syncedMeetingIds.length} recording{syncConfig.syncedMeetingIds.length !== 1 ? 's' : ''} synced)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateConfig.isPending}
            className="flex-1 px-3 py-2 rounded-md bg-primary hover:bg-primary/90 text-sm transition disabled:opacity-50"
          >
            {updateConfig.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
