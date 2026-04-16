import type { BrandMeeting, BrandActionItem } from '@momentum/shared';
import { todayIso } from '../lib/date';

export type HealthStatus = 'on_track' | 'quiet' | 'needs_attention';

export function computeBrandHealth(
  meetings: BrandMeeting[],
  actionItems: BrandActionItem[],
): HealthStatus {
  const today = todayIso();
  const openItems = actionItems.filter((a) => a.status === 'open');
  const overdueItems = openItems.filter((a) => a.dueDate && a.dueDate < today);

  if (overdueItems.length > 0 || openItems.length > 5) return 'needs_attention';

  const sortedMeetings = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  const lastMeeting = sortedMeetings[0];

  if (!lastMeeting) {
    return openItems.length > 0 ? 'needs_attention' : 'quiet';
  }

  const daysSinceLastMeeting = Math.floor(
    (new Date(today + 'T00:00:00').getTime() - new Date(lastMeeting.date + 'T00:00:00').getTime()) /
      86_400_000,
  );

  if (daysSinceLastMeeting > 30) return 'needs_attention';
  if (daysSinceLastMeeting > 14) return 'quiet';

  if (openItems.length <= 3 && overdueItems.length === 0) return 'on_track';

  return 'quiet';
}
