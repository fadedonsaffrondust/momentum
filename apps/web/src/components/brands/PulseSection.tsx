import { useMemo } from 'react';
import type { BrandMeeting, BrandActionItem, BrandStakeholder } from '@momentum/shared';
import { StakeholderBadge } from './StakeholderBadge';
import { formatDateShort } from '../../lib/format';
import { todayIso } from '../../lib/date';

interface Props {
  meetings: BrandMeeting[];
  actionItems: BrandActionItem[];
  stakeholders: BrandStakeholder[];
  onSendToToday: (id: string) => void;
  onMarkDone: (id: string) => void;
  onStakeholderClick?: (name: string) => void;
}

export function PulseSection({
  meetings,
  actionItems,
  stakeholders,
  onSendToToday,
  onMarkDone,
  onStakeholderClick,
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
    const diff = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 86_400_000,
    );
    if (diff === 0) return 'today';
    if (diff === 1) return '1d old';
    return `${diff}d old`;
  };

  return (
    <section className="px-6 py-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1A — Activity Snapshot */}
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-widest text-m-fg-muted font-semibold">
            Activity
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="text-m-fg-secondary">
              {lastMeeting ? (
                <>
                  <span className="text-m-fg-muted">Last meeting:</span>{' '}
                  {daysSince(lastMeeting.date)} — {lastMeeting.title}
                </>
              ) : (
                <span className="text-m-fg-dim">No meetings logged</span>
              )}
            </div>
            {cadence !== null && (
              <div className="text-m-fg-muted text-xs">
                Avg {cadence} days between meetings
              </div>
            )}
            <div className="text-m-fg-muted text-xs">
              {totalMeetings} meeting{totalMeetings !== 1 ? 's' : ''} logged
            </div>
          </div>
        </div>

        {/* 1B — Open Action Items (top 3) */}
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-widest text-m-fg-muted font-semibold">
            Open items
            {openCount > 0 && (
              <span className="ml-1 text-m-fg-dim">({openCount})</span>
            )}
          </h3>
          {topOpenItems.length === 0 && (
            <p className="text-xs text-m-fg-dim">No open action items.</p>
          )}
          <ul className="space-y-1.5">
            {topOpenItems.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 text-xs group"
              >
                <span className="flex-1 text-m-fg-secondary leading-snug">{item.text}</span>
                <span className="shrink-0 text-m-fg-dim">{itemAge(item.createdAt)}</span>
                <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => onSendToToday(item.id)}
                    className="text-accent hover:underline"
                    title="Send to Today"
                  >
                    →Today
                  </button>
                  <button
                    onClick={() => onMarkDone(item.id)}
                    className="text-emerald-500 hover:underline"
                    title="Mark done"
                  >
                    ✓
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {openCount > 3 && (
            <p className="text-[10px] text-accent hover:underline cursor-pointer">
              View all {openCount} open items ↓
            </p>
          )}
        </div>

        {/* 1C — Stakeholder Activity */}
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-widest text-m-fg-muted font-semibold">
            Stakeholders
          </h3>
          {stakeholders.length === 0 && (
            <p className="text-xs text-m-fg-dim">No stakeholders added yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {stakeholders.slice(0, 4).map((s, i) => (
              <StakeholderBadge
                key={s.id}
                stakeholder={s}
                index={i}
                lastMentionDate={lastMentionByStakeholder.get(s.name.toLowerCase()) ?? null}
                onClick={() => onStakeholderClick?.(s.name)}
              />
            ))}
            {stakeholders.length > 4 && (
              <span className="flex items-center justify-center w-8 h-8 rounded-full border border-m-border text-[10px] text-m-fg-muted">
                +{stakeholders.length - 4}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
