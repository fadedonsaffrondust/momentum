import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { BrandFeatureRequest, FeatureRequestsConfig } from '@momentum/shared';
import { RefreshCw, ExternalLink, Search, Plus } from 'lucide-react';
import { FeatureRequestRow } from './FeatureRequestRow';
import {
  useCreateBrandFeatureRequest,
  useUpdateBrandFeatureRequest,
  useDeleteBrandFeatureRequest,
  useConvertFeatureRequestToAction,
} from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { confirm } from '../ConfirmModal';

type StatusFilter = 'all' | 'open' | 'resolved';
type SortMode = 'date' | 'status';

interface Props {
  brandId: string;
  featureRequests: BrandFeatureRequest[];
  config: FeatureRequestsConfig | null;
  isSyncing: boolean;
  onSync: () => void;
  onConnect: () => void;
}

function todayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PAGE_SIZE = 50;

export function FeatureRequestsTab({
  brandId,
  featureRequests,
  config,
  isSyncing,
  onSync,
  onConnect,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [adding, setAdding] = useState(false);
  const [draftRequest, setDraftRequest] = useState('');
  const [draftResponse, setDraftResponse] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const addInputRef = useRef<HTMLInputElement>(null);

  const createFr = useCreateBrandFeatureRequest(brandId);
  const updateFr = useUpdateBrandFeatureRequest(brandId);
  const deleteFr = useDeleteBrandFeatureRequest(brandId);
  const convertFr = useConvertFeatureRequestToAction(brandId);
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const filtered = useMemo(() => {
    let items = featureRequests;

    if (statusFilter === 'open') items = items.filter((r) => !r.resolved);
    else if (statusFilter === 'resolved') items = items.filter((r) => r.resolved);

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) =>
          r.request.toLowerCase().includes(q) ||
          (r.response ?? '').toLowerCase().includes(q),
      );
    }

    if (sortMode === 'status') {
      items = [...items].sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        return b.date.localeCompare(a.date);
      });
    } else {
      items = [...items].sort((a, b) => b.date.localeCompare(a.date));
    }

    return items;
  }, [featureRequests, statusFilter, search, sortMode]);

  const visible = filtered.slice(0, visibleCount);
  const openCount = featureRequests.filter((r) => !r.resolved).length;
  const resolvedCount = featureRequests.filter((r) => r.resolved).length;

  const startAdding = useCallback(() => {
    setAdding(true);
    setDraftRequest('');
    setDraftResponse('');
  }, []);

  useEffect(() => {
    if (adding) return;

    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)) return;

      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        startAdding();
        return;
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onSync();
        return;
      }
      if ((e.key === 'j' || e.key === 'ArrowDown') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, visible.length - 1));
        return;
      }
      if ((e.key === 'k' || e.key === 'ArrowUp') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === ' ' && focusedIndex >= 0 && focusedIndex < visible.length) {
        e.preventDefault();
        const fr = visible[focusedIndex]!;
        handleUpdate(fr.id, { resolved: !fr.resolved });
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setFocusedIndex(-1);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const submitNew = () => {
    const request = draftRequest.trim();
    if (!request) {
      setAdding(false);
      return;
    }
    createFr.mutate(
      {
        date: todayDate(),
        request,
        response: draftResponse.trim() || null,
      },
      {
        onSuccess: () => {
          setAdding(false);
          setDraftRequest('');
          setDraftResponse('');
        },
        onError: () => {
          pushToast({ kind: 'error', message: 'Failed to create feature request', durationMs: 4000 });
        },
      },
    );
  };

  const handleUpdate = (id: string, fields: Record<string, unknown>) => {
    updateFr.mutate({ id, ...fields } as any);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('Delete this feature request?');
    if (!ok) return;
    deleteFr.mutate(id, {
      onError: () => {
        pushToast({ kind: 'error', message: 'Failed to delete feature request', durationMs: 4000 });
      },
    });
  };

  const handleConvert = (id: string) => {
    convertFr.mutate(id, {
      onSuccess: () => {
        pushToast({
          kind: 'success',
          message: 'Created action item. Feature request marked resolved.',
          durationMs: 3000,
        });
      },
      onError: () => {
        pushToast({ kind: 'error', message: 'Failed to convert to action item', durationMs: 4000 });
      },
    });
  };

  if (!config?.connected && featureRequests.length === 0) {
    return (
      <div className="py-16 px-6 flex flex-col items-center gap-4 animate-slideUp">
        <p className="text-m-fg-muted text-sm">
          No feature requests for this brand. Connect a Google Sheet or add one manually.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onConnect}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition"
          >
            Connect Google Sheet
          </button>
          <button
            onClick={startAdding}
            className="px-4 py-2 rounded-lg border border-m-border-subtle text-sm text-m-fg-secondary hover:bg-m-surface-hover transition"
          >
            Add Manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-6 space-y-4 animate-slideUp">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-m-fg">Feature Requests</h2>
          <span className="text-xs text-m-fg-muted">
            {openCount} open, {resolvedCount} resolved
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={startAdding}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-accent hover:bg-accent/10 transition"
          >
            <Plus size={14} />
            New Request
          </button>
          {config?.connected && (
            <>
              <span className="text-[11px] text-m-fg-muted">
                {config.lastSyncedAt ? `Synced ${timeAgo(config.lastSyncedAt)}` : 'Not synced yet'}
              </span>
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-m-fg-secondary hover:bg-m-surface-hover transition disabled:opacity-50"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                Sync
              </button>
              <a
                href={config.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-m-fg-muted hover:text-m-fg-secondary hover:bg-m-surface-hover transition"
              >
                <ExternalLink size={12} />
                Open in Sheets
              </a>
            </>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-m-border-subtle overflow-hidden">
          {(['open', 'resolved', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={clsx(
                'px-3 py-1.5 text-xs capitalize transition',
                statusFilter === f
                  ? 'bg-accent text-white font-medium'
                  : 'text-m-fg-muted hover:text-m-fg-secondary',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-m-fg-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-m-border-subtle bg-m-bg text-sm text-m-fg placeholder:text-m-fg-muted focus:outline-none focus:border-accent/50"
          />
        </div>

        <button
          onClick={() => setSortMode((s) => (s === 'date' ? 'status' : 'date'))}
          className="px-3 py-1.5 rounded-lg border border-m-border-subtle text-xs text-m-fg-muted hover:text-m-fg-secondary transition"
        >
          Sort: {sortMode === 'date' ? 'Newest' : 'Status'}
        </button>
      </div>

      {/* Table */}
      <div className="border border-m-border-subtle rounded-lg overflow-hidden">
        {/* Header */}
        <div
          className="grid gap-x-3 px-3 py-2 border-b border-m-border-subtle bg-m-surface/50 text-[11px] font-medium text-m-fg-muted"
          style={{ gridTemplateColumns: '70px 1fr 1fr 32px 52px' }}
        >
          <div>Date</div>
          <div>Request</div>
          <div>Response</div>
          <div className="text-center">Done</div>
          <div />
        </div>

        {/* New request row */}
        {adding && (
          <div
            className="grid gap-x-3 px-3 py-2 border-b border-m-border-subtle bg-accent/5"
            style={{ gridTemplateColumns: '70px 1fr 1fr 32px 52px' }}
          >
            <div className="text-[11px] font-mono text-m-fg-muted pt-0.5">{todayDate()}</div>
            <div>
              <input
                ref={addInputRef}
                type="text"
                value={draftRequest}
                onChange={(e) => setDraftRequest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNew();
                  if (e.key === 'Escape') setAdding(false);
                  if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    document.getElementById('fr-draft-response')?.focus();
                  }
                }}
                placeholder="What's the request?"
                className="w-full bg-m-bg border border-accent/50 rounded px-2 py-0.5 text-xs focus:outline-none placeholder:text-m-fg-muted"
              />
            </div>
            <div>
              <input
                id="fr-draft-response"
                type="text"
                value={draftResponse}
                onChange={(e) => setDraftResponse(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNew();
                  if (e.key === 'Escape') setAdding(false);
                }}
                placeholder="Response (optional)"
                className="w-full bg-m-bg border border-m-border-subtle rounded px-2 py-0.5 text-xs focus:outline-none focus:border-accent/50 placeholder:text-m-fg-muted"
              />
            </div>
            <div className="flex items-start justify-center pt-0.5">
              <span className="inline-block w-3.5 h-3.5 rounded border-[1.5px] border-m-border bg-transparent" />
            </div>
            <div />
          </div>
        )}

        {/* Rows */}
        {visible.length === 0 && !adding ? (
          <div className="px-4 py-8 text-center text-xs text-m-fg-muted">
            {search ? 'No requests match your search.' : 'No feature requests to show.'}
          </div>
        ) : (
          visible.map((fr, i) => (
            <FeatureRequestRow
              key={fr.id}
              fr={fr}
              rowIndex={adding ? i + 1 : i}
              isFocused={focusedIndex === i}
              onUpdate={(fields) => handleUpdate(fr.id, fields)}
              onDelete={() => handleDelete(fr.id)}
              onConvert={() => handleConvert(fr.id)}
              isPending={updateFr.isPending && (updateFr.variables as any)?.id === fr.id}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {visibleCount < filtered.length && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-4 py-2 rounded-lg text-xs text-m-fg-muted hover:text-m-fg-secondary hover:bg-m-surface-hover transition"
          >
            Load more ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
