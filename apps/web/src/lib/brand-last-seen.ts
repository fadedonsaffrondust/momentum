/**
 * Per-brand "last seen" timestamp persisted in localStorage. Drives the
 * unseen-activity dot on the brand list (spec §9.2). Stored as a single
 * JSON object keyed by brand id → ISO timestamp so one read/write handles
 * the whole roster.
 */

const STORAGE_KEY = 'momentum-brand-last-seen';

type LastSeenMap = Record<string, string>;

function read(): LastSeenMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as LastSeenMap;
  } catch {
    return {};
  }
}

function write(map: LastSeenMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded / private mode — silently ignore, worst case the
    // dot keeps showing for a brand we've already visited.
  }
}

export function getLastSeen(brandId: string): string | null {
  return read()[brandId] ?? null;
}

export function markBrandSeen(brandId: string): void {
  const map = read();
  map[brandId] = new Date().toISOString();
  write(map);
  // Let listening components react without a full page reload — used by
  // useBrandUnseen to re-render when the user opens a brand.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('momentum:brand-seen', { detail: { brandId } }));
  }
}
