import { useState } from 'react';
import { useSettings } from '../api/hooks';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function BackupReminder() {
  const settingsQ = useSettings();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  const last = settingsQ.data?.lastExportDate;
  if (!last) return null;

  const age = Date.now() - new Date(last).getTime();
  if (age < SEVEN_DAYS_MS) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200 shadow-lg">
      <span>It's been a while since your last backup.</span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('momentum:export'))}
        className="text-amber-100 hover:underline"
      >
        Export now
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-300/70 hover:text-amber-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
