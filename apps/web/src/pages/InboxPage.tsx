import { useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import type { InboxEvent } from '@momentum/shared';
import {
  useInbox,
  useInboxUnreadCount,
  useMarkAllInboxRead,
  useMarkInboxRead,
} from '../api/hooks';
import { useUiStore, type InboxFilter } from '../store/ui';
import { Avatar } from '../components/Avatar';
import { useInboxKeyboardController } from '../hooks/useInboxKeyboardController';
import { formatTimeAgo } from '../lib/format';
import { markBrandSeen } from '../lib/brand-last-seen';

/**
 * Inbox (/inbox, spec §9.8). Reverse-chronological list of events
 * scoped to the current user. Filter Unread/All at the top, mark-all-
 * read button, keyboard-driven row navigation. Clicking a row marks it
 * read and navigates to the entity.
 */
export function InboxPage() {
  const navigate = useNavigate();
  const filter = useUiStore((s) => s.inboxFilter);
  const setFilter = useUiStore((s) => s.setInboxFilter);
  const selected = useUiStore((s) => s.selectedInboxEventId);
  const setSelected = useUiStore((s) => s.setSelectedInboxEventId);

  const inboxQ = useInbox(filter === 'unread' ? { unreadOnly: 'true' } : {});
  const unreadQ = useInboxUnreadCount();
  const markRead = useMarkInboxRead();
  const markAllRead = useMarkAllInboxRead();

  const events = useMemo(() => inboxQ.data ?? [], [inboxQ.data]);
  const unread = unreadQ.data?.count ?? 0;

  // If the current selection vanishes from the list (e.g., filter flipped
  // unread-only after the row was marked read), fall back to the first row.
  useEffect(() => {
    if (!selected || events.length === 0) return;
    if (!events.some((e) => e.id === selected)) {
      setSelected(events[0]?.id ?? null);
    }
  }, [events, selected, setSelected]);

  const handleOpen = (event: InboxEvent) => {
    const unreadAtClick = !event.readAt;
    if (unreadAtClick) {
      markRead.mutate(event.id);
    }
    const route = routeForEvent(event);
    if (route) {
      // For brand-action-item events we also stamp the brand as seen so
      // the sidebar dot clears atomically with the inbox navigation.
      const brandId = (event.payload as Record<string, unknown>)['brandId'];
      if (typeof brandId === 'string' && event.entityType === 'brand_action_item') {
        markBrandSeen(brandId);
      }
      navigate(route);
    }
  };

  useInboxKeyboardController({
    events,
    onOpen: handleOpen,
    onToggleRead: (event) => {
      if (event.readAt) {
        // Backend has no "unread" toggle yet — noop; spec §9.8 lists
        // Space as a toggle, but when the underlying row is already
        // read we can't re-mark it unread without a new endpoint. Flag
        // for V1.5.
        return;
      }
      markRead.mutate(event.id);
    },
    onMarkAllRead: () => markAllRead.mutate(),
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <h1 className="text-lg text-primary">Inbox</h1>
          {unread > 0 && (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {unread} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FilterChip value={filter} onChange={setFilter} />
          <button
            onClick={() => markAllRead.mutate()}
            disabled={unread === 0 || markAllRead.isPending}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary transition disabled:opacity-40"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {inboxQ.isLoading && (
          <p className="text-sm text-muted-foreground px-6 py-4">Loading inbox…</p>
        )}
        {!inboxQ.isLoading && events.length === 0 && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {filter === 'unread' ? 'No unread events.' : 'No inbox events yet.'}
            </p>
            {filter === 'unread' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                See all events →
              </button>
            )}
          </div>
        )}
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <InboxRow
                event={event}
                isSelected={selected === event.id}
                onSelect={() => setSelected(event.id)}
                onOpen={() => handleOpen(event)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InboxRow({
  event,
  isSelected,
  onSelect,
  onOpen,
}: {
  event: InboxEvent;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const unread = !event.readAt;

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const { description, preview } = describeInboxEvent(event);

  return (
    <button
      ref={rowRef}
      type="button"
      onMouseEnter={onSelect}
      onClick={onOpen}
      className={clsx(
        'w-full flex items-start gap-3 px-6 py-3 text-left border-b border-border/60 transition',
        isSelected ? 'bg-card' : 'hover:bg-card/60',
      )}
    >
      {unread && (
        <span
          className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0"
          aria-label="Unread"
        />
      )}
      {!unread && <span className="mt-1.5 w-1.5 h-1.5 shrink-0" />}
      <Avatar user={event.actor} size="sm" showTooltip={false} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div
          className={clsx(
            'text-sm leading-snug break-words',
            unread ? 'text-foreground font-medium' : 'text-muted-foreground',
          )}
        >
          <span className="text-foreground">
            {event.actor.displayName || event.actor.email}
          </span>{' '}
          {description}
        </div>
        {preview && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{preview}</div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground/70 shrink-0 mt-1">
        {formatTimeAgo(event.createdAt)}
      </div>
    </button>
  );
}

function FilterChip({
  value,
  onChange,
}: {
  value: InboxFilter;
  onChange: (v: InboxFilter) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Inbox filter"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/40 p-0.5 text-xs"
    >
      {(['unread', 'all'] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={clsx(
              'px-2.5 py-1 rounded-md transition font-medium',
              active
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt === 'unread' ? 'Unread' : 'All'}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Human-readable inbox event description (spec §9.8). Returns the main
 * description ("Sara assigned you a task:") and a preview subline (the
 * entity's title/text) for the detail row.
 */
function describeInboxEvent(event: InboxEvent): {
  description: string;
  preview: string | null;
} {
  const entityTitle = event.entity?.title ?? null;
  const brandName =
    typeof event.entity === 'object' && event.entity !== null
      ? (event.entity as Record<string, unknown>)['brandName']
      : undefined;
  const brandSuffix = typeof brandName === 'string' ? ` on ${brandName}` : '';

  switch (event.eventType) {
    case 'task_assigned':
      return {
        description: 'assigned you a task:',
        preview: entityTitle,
      };
    case 'task_edited': {
      const changed = (event.payload as Record<string, unknown>)['changedFields'];
      const fieldList = Array.isArray(changed)
        ? (changed as string[]).join(', ')
        : '';
      return {
        description: fieldList
          ? `updated ${fieldList} on a task assigned to you:`
          : 'updated a task assigned to you:',
        preview: entityTitle,
      };
    }
    case 'action_item_assigned':
      return {
        description: `assigned you an action item${brandSuffix}:`,
        preview: entityTitle,
      };
    case 'action_item_edited':
      return {
        description: `updated an action item assigned to you${brandSuffix}:`,
        preview: entityTitle,
      };
    case 'parking_involvement':
      return {
        description: 'added you to a parking:',
        preview: entityTitle,
      };
    default:
      return { description: String(event.eventType).replace(/_/g, ' '), preview: entityTitle };
  }
}

/**
 * Map an inbox event to the route its entity lives at. Returns null when
 * the entity was deleted or can't be linked to (rare in V1).
 */
function routeForEvent(event: InboxEvent): string | null {
  if (!event.entity) return null;
  switch (event.entityType) {
    case 'task':
      return '/';
    case 'parking':
      return '/parkings';
    case 'brand_action_item': {
      const brandId =
        typeof event.entity === 'object' && event.entity !== null
          ? (event.entity as Record<string, unknown>)['brandId']
          : undefined;
      if (typeof brandId === 'string') return `/brands/${brandId}`;
      return '/brands';
    }
    default:
      return null;
  }
}
