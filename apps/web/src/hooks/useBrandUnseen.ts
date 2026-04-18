import { useEffect, useState } from 'react';
import { useBrandEvents, useMe } from '../api/hooks';
import { getLastSeen } from '../lib/brand-last-seen';

/**
 * Returns `true` when the brand has at least one event newer than the
 * viewer's `last-seen` stamp AND the actor isn't the viewer themselves.
 * Acting on a brand doesn't mark your own brand as "new activity" — that
 * would be confusing.
 *
 * Subscribes to the `momentum:brand-seen` window event so the dot
 * disappears instantly when the user clicks into the brand (no refetch
 * required; `markBrandSeen` writes LocalStorage + fires the event).
 */
export function useBrandUnseen(brandId: string): boolean {
  const meQ = useMe();
  const eventsQ = useBrandEvents(brandId, { limit: 1 });
  const [lastSeen, setLastSeen] = useState<string | null>(() => getLastSeen(brandId));

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ brandId: string }>).detail;
      if (!detail || detail.brandId === brandId) {
        setLastSeen(getLastSeen(brandId));
      }
    };
    window.addEventListener('momentum:brand-seen', handler);
    return () => window.removeEventListener('momentum:brand-seen', handler);
  }, [brandId]);

  const latest = eventsQ.data?.[0];
  if (!latest) return false;
  if (meQ.data && latest.actor.id === meQ.data.id) return false;
  if (!lastSeen) return true;
  return latest.createdAt > lastSeen;
}
