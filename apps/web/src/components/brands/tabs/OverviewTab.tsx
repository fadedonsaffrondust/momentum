import { useMemo } from 'react';
import type {
  Brand,
  BrandActionItem,
  BrandFeatureRequest,
  BrandMeeting,
  BrandStakeholder,
} from '@momentum/shared';
import { todayIso } from '../../../lib/date';
import { NorthStarFieldsEditor } from '../sections/NorthStarFieldsEditor';
import { RecentActivitySection } from '../sections/RecentActivitySection';
import { StakeholderEditor } from '../sections/StakeholderEditor';
import { RawContextCollapsible } from '../widgets/RawContextCollapsible';

interface Props {
  brand: Brand;
  meetings: BrandMeeting[];
  actionItems: BrandActionItem[];
  stakeholders: BrandStakeholder[];
  featureRequests: BrandFeatureRequest[];
  onSendToToday: (id: string) => void;
  onMarkDone: (id: string) => void;
  onSwitchToFeatureRequests: () => void;
  onSwitchToWork?: () => void;
  onOpenMeeting?: (meetingId: string) => void;
}

export function OverviewTab({
  brand,
  meetings,
  actionItems,
  stakeholders,
  featureRequests,
  onSendToToday,
  onMarkDone,
  onSwitchToFeatureRequests,
  onSwitchToWork,
  onOpenMeeting,
}: Props) {
  const today = todayIso();

  const { lastMeeting, cadence, totalMeetings } = useMemo(() => {
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    const last = sorted[0];
    let cadence: number | null = null;

    if (sorted.length >= 2) {
      let totalGap = 0;
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = new Date(sorted[i]!.date + 'T00:00:00');
        const b = new Date(sorted[i + 1]!.date + 'T00:00:00');
        totalGap += Math.abs(a.getTime() - b.getTime()) / 86_400_000;
      }
      cadence = Math.round((totalGap / (sorted.length - 1)) * 10) / 10;
    }

    return { lastMeeting: last, cadence, totalMeetings: sorted.length };
  }, [meetings]);

  const topOpenItems = useMemo(
    () =>
      actionItems
        .filter((a) => a.status === 'open')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3),
    [actionItems],
  );

  const openCount = actionItems.filter((a) => a.status === 'open').length;

  const lastMentionByStakeholder = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    for (const m of sorted) {
      for (const attendee of m.attendees) {
        const key = attendee.toLowerCase();
        if (!map.has(key)) map.set(key, m.date);
      }
    }
    return map;
  }, [meetings]);

  const daysSince = (dateStr: string) => {
    const diff = Math.floor(
      (new Date(today + 'T00:00:00').getTime() - new Date(dateStr + 'T00:00:00').getTime()) /
        86_400_000,
    );
    if (diff === 0) return 'Today';
    if (diff === 1) return '1d ago';
    return `${diff}d ago`;
  };

  const itemAge = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
    if (diff === 0) return 'today';
    if (diff === 1) return '1d old';
    return `${diff}d old`;
  };

  return (
    <div className="py-6 px-6 space-y-6 animate-slideUp">
      {/* Health Card */}
      <div className="bg-card rounded-xl p-6 border border-border/60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Activity Stats */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold">
              Activity
            </h3>
            <div className="space-y-1.5">
              <div className="text-sm text-foreground">
                {lastMeeting ? (
                  <>
                    <span className="text-muted-foreground">Last meeting:</span>{' '}
                    <span className="text-foreground">{daysSince(lastMeeting.date)}</span>
                    {' — '}
                    {lastMeeting.title}
                  </>
                ) : (
                  <span className="text-muted-foreground">No meetings logged</span>
                )}
              </div>
              {cadence !== null && (
                <div className="text-sm text-muted-foreground">
                  Avg {cadence} days between meetings
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {totalMeetings} meeting{totalMeetings !== 1 ? 's' : ''} logged
              </div>
            </div>
          </div>

          {/* Top Open Items */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold">
              Open items
              {openCount > 0 && <span className="ml-1 text-muted-foreground">({openCount})</span>}
            </h3>
            {topOpenItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open action items.</p>
            ) : (
              <ul className="space-y-2">
                {topOpenItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-sm group">
                    <span className="flex-1 text-foreground leading-snug">{item.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {itemAge(item.createdAt)}
                    </span>
                    <div className="shrink-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => onSendToToday(item.id)}
                        className="text-xs text-primary hover:underline"
                        title="Send to Today"
                      >
                        +Today
                      </button>
                      <button
                        onClick={() => onMarkDone(item.id)}
                        className="text-xs text-emerald-500 hover:underline"
                        title="Mark done"
                      >
                        Done
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {openCount > 3 && (
              <p className="text-xs text-primary">+{openCount - 3} more open items</p>
            )}
          </div>

          {/* Feature Requests */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold">
              Feature Requests
            </h3>
            {featureRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feature requests yet.</p>
            ) : (
              <div className="space-y-1.5">
                <div className="text-sm text-foreground">
                  <span className="text-foreground font-medium">
                    {featureRequests.filter((r) => !r.resolved).length}
                  </span>{' '}
                  <span className="text-muted-foreground">open</span>
                  {', '}
                  <span className="text-foreground font-medium">
                    {featureRequests.filter((r) => r.resolved).length}
                  </span>{' '}
                  <span className="text-muted-foreground">resolved</span>
                </div>
                {brand.featureRequestsConfig?.connected && (
                  <div className="text-xs text-muted-foreground">Sheet connected</div>
                )}
              </div>
            )}
            <button
              onClick={onSwitchToFeatureRequests}
              className="text-xs text-primary hover:underline"
            >
              View all →
            </button>
          </div>
        </div>
      </div>

      {/* Stakeholders Grid */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold mb-3">
          Key Stakeholders
          {stakeholders.length > 0 && (
            <span className="ml-1 text-muted-foreground">({stakeholders.length})</span>
          )}
        </h3>
        <StakeholderEditor
          brandId={brand.id}
          stakeholders={stakeholders}
          lastMentionByStakeholder={lastMentionByStakeholder}
        />
      </div>

      {/* North Star */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-foreground font-semibold mb-3">
          North Star
        </h3>
        <NorthStarFieldsEditor brand={brand} />
      </div>

      {/* Recent Activity */}
      <RecentActivitySection
        brandId={brand.id}
        onOpenActionItems={onSwitchToWork}
        onOpenMeeting={onOpenMeeting}
      />

      {/* Raw Context — collapsed by default */}
      {brand.rawImportContent && (
        <RawContextCollapsible
          content={brand.rawImportContent}
          source={brand.importedFrom ?? null}
        />
      )}
    </div>
  );
}
