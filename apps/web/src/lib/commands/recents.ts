const STORAGE_KEY = 'momentum:palette:recents:v1';
const MAX_RECENTS = 5;

function safeParse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function loadRecents(): string[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function pushRecent(id: string): string[] {
  if (typeof window === 'undefined') return [];
  const existing = loadRecents();
  const next = [id, ...existing.filter((x) => x !== id)].slice(0, MAX_RECENTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage may throw in private mode — Recent simply won't persist.
  }
  return next;
}
