import { useNavigate } from 'react-router-dom';
import type { JarvisConversationSummary } from '@momentum/shared';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Kbd } from '@/components/ui/kbd';
import { formatTimeAgo } from '../lib/format';

export interface ConversationListProps {
  conversations: JarvisConversationSummary[];
  activeConversationId: string | null;
  isLoading: boolean;
  onNewConversation: () => void;
  onSelect: (id: string) => void;
  /** Two-way-bound search input. List filtering is client-side only in V1. */
  searchValue: string;
  onSearchChange: (value: string) => void;
}

/**
 * Left rail of /jarvis. Shows a search input at top, a "new" button, and
 * the owner's conversations (recent-first). Rows render title + a
 * relative timestamp; the active conversation is highlighted.
 *
 * Keyboard handling (`j`/`k`/`Enter`) is wired in Task 11 via
 * `useJarvisKeyboardController` — this component is purely presentational
 * so it can be unit-tested without a keyboard fixture.
 */
export function ConversationList({
  conversations,
  activeConversationId,
  isLoading,
  onNewConversation,
  onSelect,
  searchValue,
  onSearchChange,
}: ConversationListProps) {
  const filtered = filterBySearch(conversations, searchValue);
  const navigate = useNavigate();

  const handleSelect = (id: string) => {
    onSelect(id);
    navigate(`/jarvis/${id}`);
  };

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card/60">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          />
        </div>
        <button
          type="button"
          onClick={onNewConversation}
          aria-label="New conversation"
          className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" data-jarvis-conversation-list="true">
        {isLoading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyListState hasConversations={conversations.length > 0} />
        ) : (
          <ul role="list" className="flex flex-col">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left transition-colors duration-150',
                    c.id === activeConversationId
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                  aria-current={c.id === activeConversationId ? 'page' : undefined}
                >
                  <span className="line-clamp-1 w-full text-sm text-foreground">
                    {c.title || 'Untitled'}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {formatTimeAgo(c.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyListState({ hasConversations }: { hasConversations: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-xs text-muted-foreground">
        {hasConversations ? 'No matches' : 'No conversations yet'}
      </p>
      {!hasConversations ? (
        <p className="text-2xs text-muted-foreground">
          Press <Kbd className="mx-0.5 h-4 min-w-4 text-[10px]">n</Kbd> to start one
        </p>
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex flex-col" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex flex-col gap-1 border-b border-border/60 px-3 py-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-2 w-1/3 animate-pulse rounded bg-muted/60" />
        </li>
      ))}
    </ul>
  );
}

function filterBySearch(
  conversations: JarvisConversationSummary[],
  query: string,
): JarvisConversationSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;
  return conversations.filter((c) => c.title.toLowerCase().includes(q));
}
