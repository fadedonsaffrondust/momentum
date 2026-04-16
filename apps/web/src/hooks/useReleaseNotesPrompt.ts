import { useEffect, useSyncExternalStore } from 'react';
import { useUiStore } from '../store/ui';
import { LATEST_VERSION, compareVersions } from '../lib/releaseNotes';

const STORAGE_KEY = 'momentum:lastSeenReleaseVersion';
const CHANGE_EVENT = 'momentum:release-seen';

export function getLastSeenVersion(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function markReleaseSeen(version: string = LATEST_VERSION): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, version);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/**
 * React hook that returns true when there's a release newer than what the
 * user has acknowledged. Re-renders on `markReleaseSeen()` and cross-tab
 * storage events.
 */
export function useHasUnseenRelease(): boolean {
  const lastSeen = useSyncExternalStore(subscribe, getLastSeenVersion, () => null);
  if (!lastSeen) return true;
  return compareVersions(lastSeen, LATEST_VERSION) < 0;
}

/**
 * Auto-opens the release notes modal once per new version, after the user is
 * onboarded. Idempotent across remounts in the same session.
 */
let shownThisSession = false;

export function useReleaseNotesPrompt(ready: boolean): void {
  const openModal = useUiStore((s) => s.openModal);
  const activeModal = useUiStore((s) => s.activeModal);

  useEffect(() => {
    if (!ready || shownThisSession || activeModal) return;
    const lastSeen = getLastSeenVersion();
    const isFresh = !lastSeen || compareVersions(lastSeen, LATEST_VERSION) < 0;
    if (!isFresh) return;
    shownThisSession = true;
    // Small delay so the app renders first, not jarring.
    const timer = window.setTimeout(() => openModal('release-notes'), 450);
    return () => window.clearTimeout(timer);
  }, [ready, activeModal, openModal]);
}
