import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BrandEvent } from '@momentum/shared';
import { useBrandEvents } from '../../../api/hooks';
import { Avatar } from '../../Avatar';
import { formatTimeAgo } from '../../../lib/format';

interface Props {
  brandId: string;
  /** Called when a brand_action_item row is clicked. */
  onOpenActionItems?: () => void;
  /** Called when a brand_meeting row is clicked. */
  onOpenMeeting?: (meetingId: string) => void;
}

const PREVIEW_COUNT = 5;

/**
 * Recent Activity panel on the brand Overview tab (spec §9.6). Shows
 * reverse-chronological brand events with hydrated actor avatars. First
 * five are always visible; the rest are tucked behind a "Show more"
 * disclosure. Clicking an event routes to its entity when the caller
 * provides a handler.
 */
export function RecentActivitySection({ brandId, onOpenActionItems, onOpenMeeting }: Props) {
  const eventsQ = useBrandEvents(brandId, { limit: 20 });
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const events = eventsQ.data ?? [];
  const visible = showAll ? events : events.slice(0, PREVIEW_COUNT);
  const hiddenCount = Math.max(0, events.length - PREVIEW_COUNT);

  if (eventsQ.isLoading) {
    return <div className="text-xs text-muted-foreground px-1 py-2">Loading activity…</div>;
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-foreground font-semibold hover:text-foreground transition"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Recent activity
        <span className="text-muted-foreground normal-case tracking-normal font-normal">
          ({events.length})
        </span>
      </button>

      {expanded && (
        <ul className="mt-3 space-y-1.5 animate-slideUp">
          {visible.map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
              onOpenActionItems={onOpenActionItems}
              onOpenMeeting={onOpenMeeting}
            />
          ))}
          {!showAll && hiddenCount > 0 && (
            <li>
              <button
                onClick={() => setShowAll(true)}
                className="text-xs text-primary hover:underline pl-7"
              >
                Show {hiddenCount} more
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ActivityRow({
  event,
  onOpenActionItems,
  onOpenMeeting,
}: {
  event: BrandEvent;
  onOpenActionItems?: () => void;
  onOpenMeeting?: (meetingId: string) => void;
}) {
  const { description, canClick } = describeEvent(event);

  const handleClick = () => {
    if (!canClick) return;
    if (event.entityType === 'brand_action_item' && onOpenActionItems) {
      onOpenActionItems();
    } else if (event.entityType === 'brand_meeting' && event.entityId && onOpenMeeting) {
      onOpenMeeting(event.entityId);
    }
  };

  const clickable =
    canClick &&
    ((event.entityType === 'brand_action_item' && onOpenActionItems) ||
      (event.entityType === 'brand_meeting' && event.entityId && onOpenMeeting));

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        disabled={!clickable}
        className={
          clickable
            ? 'w-full text-left flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-card/60 transition cursor-pointer'
            : 'w-full text-left flex items-start gap-2.5 rounded-md px-2 py-1.5 cursor-default'
        }
      >
        <Avatar user={event.actor} size="sm" showTooltip={false} className="mt-0.5" />
        <div className="flex-1 min-w-0 text-sm">
          <div className="text-foreground leading-snug break-words">
            <span className="text-foreground">{event.actor.displayName || event.actor.email}</span>{' '}
            {description}
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-0.5">
            {formatTimeAgo(event.createdAt)}
          </div>
        </div>
      </button>
    </li>
  );
}

/**
 * Human-readable event description per spec §9.8 + §5.8. Returns
 * `canClick=false` for event types whose entity target is deleted or
 * not meaningfully navigable.
 */
function describeEvent(event: BrandEvent): { description: string; canClick: boolean } {
  const payload = event.payload as Record<string, unknown>;
  const text = typeof payload['text'] === 'string' ? (payload['text'] as string) : undefined;
  const title = typeof payload['title'] === 'string' ? (payload['title'] as string) : undefined;
  const name = typeof payload['name'] === 'string' ? (payload['name'] as string) : undefined;
  const request =
    typeof payload['request'] === 'string' ? (payload['request'] as string) : undefined;
  const action = typeof payload['action'] === 'string' ? (payload['action'] as string) : undefined;

  switch (event.eventType) {
    case 'stakeholder_added':
      return {
        description: `added stakeholder ${name ? `"${name}"` : ''}`,
        canClick: false,
      };
    case 'stakeholder_edited':
      return {
        description: `edited stakeholder ${name ? `"${name}"` : ''}`,
        canClick: false,
      };
    case 'stakeholder_removed':
      return {
        description: `removed stakeholder ${name ? `"${name}"` : ''}`,
        canClick: false,
      };
    case 'meeting_added':
      return {
        description: `logged meeting ${title ? `"${title}"` : ''}`,
        canClick: true,
      };
    case 'meeting_edited':
      return {
        description: `edited meeting ${title ? `"${title}"` : ''}`,
        canClick: true,
      };
    case 'meeting_deleted':
      return {
        description: `deleted meeting ${title ? `"${title}"` : ''}`,
        canClick: false,
      };
    case 'action_item_created':
      return {
        description: `created action item ${text ? `"${clip(text)}"` : ''}`,
        canClick: true,
      };
    case 'action_item_completed':
      return {
        description: `completed action item ${text ? `"${clip(text)}"` : ''}`,
        canClick: true,
      };
    case 'action_item_reopened':
      return {
        description: `reopened action item ${text ? `"${clip(text)}"` : ''}`,
        canClick: true,
      };
    case 'action_item_assigned':
      return {
        description: `reassigned action item ${text ? `"${clip(text)}"` : ''}`,
        canClick: true,
      };
    case 'action_item_edited':
      return {
        description: `edited action item ${text ? `"${clip(text)}"` : ''}`,
        canClick: true,
      };
    case 'feature_request_added':
      return {
        description: `added feature request ${request ? `"${clip(request)}"` : ''}`,
        canClick: false,
      };
    case 'feature_request_resolved':
      return {
        description: `resolved feature request ${request ? `"${clip(request)}"` : ''}`,
        canClick: false,
      };
    case 'feature_request_deleted':
      return {
        description: `deleted feature request ${request ? `"${clip(request)}"` : ''}`,
        canClick: false,
      };
    case 'brand_edited':
      if (action === 'created') return { description: 'created this brand', canClick: false };
      if (action === 'deleted') return { description: 'deleted this brand', canClick: false };
      return { description: 'edited brand details', canClick: false };
    case 'recording_synced':
      return {
        description: `synced recording ${title ? `"${title}"` : ''}`,
        canClick: true,
      };
    default: {
      // Exhaustive switch guarded by `BrandEventType`; keeping a branch
      // for forward-compat if the enum grows before this component does.
      // `unknownType` is just for string manipulation.
      const unknownType: string = event.eventType;
      return { description: unknownType.replace(/_/g, ' '), canClick: false };
    }
  }
}

function clip(s: string, max = 60): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}
