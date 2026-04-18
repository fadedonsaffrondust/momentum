import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { SyncCandidate, SyncConfirmResponse } from '@momentum/shared';
import { useFetchSyncCandidates, useConfirmSync, useLookupMeeting } from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { SyncCandidateRow } from './SyncCandidateRow';
import { X, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Link2 } from 'lucide-react';

interface Props {
  brandId: string;
  brandName: string;
  onClose: () => void;
}

type Phase = 'loading' | 'review' | 'syncing' | 'done' | 'error';

export function SyncReviewModal({ brandId, brandName, onClose }: Props) {
  const fetchCandidates = useFetchSyncCandidates(brandId);
  const confirmSync = useConfirmSync(brandId);
  const lookupMeeting = useLookupMeeting(brandId);
  const pushToast = useUiStore((s) => s.pushToast);

  const [phase, setPhase] = useState<Phase>('loading');
  const [likely, setLikely] = useState<SyncCandidate[]>([]);
  const [possible, setPossible] = useState<SyncCandidate[]>([]);
  const [manual, setManual] = useState<SyncCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [syncProgress, setSyncProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncConfirmResponse | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const allCandidates = [...likely, ...possible, ...manual];

  // Fetch candidates on mount
  useEffect(() => {
    fetchCandidates.mutate(undefined, {
      onSuccess: (data) => {
        setLikely(data.likely);
        setPossible(data.possible);
        setLastSyncedAt(data.lastSyncedAt);
        // Pre-check likely matches
        setSelected(new Set(data.likely.map((c) => c.meeting.id)));
        setPhase('review');
      },
      onError: (err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch recordings');
        setPhase('error');
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCandidate = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleConfirm = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    setPhase('syncing');
    setSyncProgress(`Processing ${ids.length} recording${ids.length !== 1 ? 's' : ''}…`);

    confirmSync.mutate(ids, {
      onSuccess: (result) => {
        setSyncResult(result);
        setPhase('done');
      },
      onError: (err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Sync failed');
        setPhase('error');
      },
    });
  };

  const handleManualLookup = () => {
    const ref = manualInput.trim();
    if (!ref) return;
    setManualError('');
    lookupMeeting.mutate(ref, {
      onSuccess: (candidate) => {
        if (
          manual.some((m) => m.meeting.id === candidate.meeting.id) ||
          likely.some((c) => c.meeting.id === candidate.meeting.id) ||
          possible.some((c) => c.meeting.id === candidate.meeting.id)
        ) {
          setManualError('This meeting is already in the list.');
          return;
        }
        setManual((prev) => [...prev, candidate]);
        setSelected((prev) => new Set([...prev, candidate.meeting.id]));
        setManualInput('');
      },
      onError: (err) => {
        setManualError(err instanceof Error ? err.message : 'Failed to look up meeting');
      },
    });
  };

  // Keyboard: close on Escape/Enter in done phase
  useEffect(() => {
    if (phase !== 'done') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (phase !== 'review') return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, allCandidates.length - 1));
        return;
      }

      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const candidate = allCandidates[focusIndex];
        if (candidate) toggleCandidate(candidate.meeting.id);
        return;
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleConfirm();
        return;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, focusIndex, allCandidates.length, selected]);

  const sinceText = lastSyncedAt
    ? `since ${new Date(lastSyncedAt).toLocaleDateString()}`
    : 'from last 30 days';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Sync Recordings for ${brandName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[640px] max-h-[80vh] mx-4 rounded-xl border border-border bg-background shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Sync Recordings for {brandName}
            </h2>
            {phase === 'review' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Found {allCandidates.length} meeting{allCandidates.length !== 1 ? 's' : ''} {sinceText}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Searching for recordings…</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-red-400">{errorMessage}</p>
              <button
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                Close
              </button>
            </div>
          )}

          {phase === 'syncing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{syncProgress}</p>
              <p className="text-xs text-muted-foreground/70">
                Fetching transcripts and extracting content…
              </p>
            </div>
          )}

          {phase === 'done' && syncResult && (
            <div className="py-6 space-y-5">
              {/* Recordings */}
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {syncResult.imported} recording{syncResult.imported !== 1 ? 's' : ''} synced
                  </p>
                  {syncResult.pendingTranscripts > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {syncResult.pendingTranscripts} still processing — re-sync later to extract content
                    </p>
                  )}
                </div>
              </div>

              {/* Action Items */}
              {syncResult.actionItemStats.extracted > 0 && (
                <div className="flex items-start gap-3">
                  <ArrowRight size={18} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {syncResult.actionItemStats.extracted} action item{syncResult.actionItemStats.extracted !== 1 ? 's' : ''} extracted
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs text-emerald-500">
                        {syncResult.actionItemStats.created} new
                      </span>
                      {syncResult.actionItemStats.skipped > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {syncResult.actionItemStats.skipped} duplicate{syncResult.actionItemStats.skipped !== 1 ? 's' : ''} skipped
                        </span>
                      )}
                      {syncResult.actionItemStats.updated > 0 && (
                        <span className="text-xs text-amber-500">
                          {syncResult.actionItemStats.updated} updated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {syncResult.actionItemStats.extracted === 0 && syncResult.imported > 0 && (
                <div className="flex items-start gap-3">
                  <ArrowRight size={18} className="text-muted-foreground/70 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">No action items found in these recordings</p>
                </div>
              )}

              {/* Errors */}
              {syncResult.errors.length > 0 && (
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {syncResult.errors.length} error{syncResult.errors.length !== 1 ? 's' : ''}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {syncResult.errors.map((err, i) => (
                        <li key={i} className="text-xs text-muted-foreground">{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'review' && likely.length === 0 && possible.length === 0 && manual.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                No new recordings found matching your rules for {brandName}.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Try adjusting your matching rules, or link a recording manually below.
              </p>
            </div>
          )}

          {phase === 'review' && likely.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[10px] uppercase tracking-widest text-emerald-500 font-semibold mb-2">
                Likely Matches ({likely.length})
              </h3>
              <div className="space-y-2">
                {likely.map((c, i) => (
                  <SyncCandidateRow
                    key={c.meeting.id}
                    candidate={c}
                    checked={selected.has(c.meeting.id)}
                    focused={focusIndex === i}
                    onToggle={() => toggleCandidate(c.meeting.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {phase === 'review' && possible.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold mb-2">
                Possible Matches ({possible.length})
              </h3>
              <div className="space-y-2">
                {possible.map((c, i) => (
                  <SyncCandidateRow
                    key={c.meeting.id}
                    candidate={c}
                    checked={selected.has(c.meeting.id)}
                    focused={focusIndex === likely.length + i}
                    onToggle={() => toggleCandidate(c.meeting.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {phase === 'review' && manual.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">
                Manually Added ({manual.length})
              </h3>
              <div className="space-y-2">
                {manual.map((c, i) => (
                  <SyncCandidateRow
                    key={c.meeting.id}
                    candidate={c}
                    checked={selected.has(c.meeting.id)}
                    focused={focusIndex === likely.length + possible.length + i}
                    onToggle={() => toggleCandidate(c.meeting.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {phase === 'review' && (
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2 mb-2">
                <Link2 size={12} className="text-muted-foreground/70" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Link manually
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value);
                    setManualError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleManualLookup();
                    }
                  }}
                  placeholder="Paste recording URL or meeting ID"
                  className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/70"
                />
                <button
                  onClick={handleManualLookup}
                  disabled={!manualInput.trim() || lookupMeeting.isPending}
                  className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {lookupMeeting.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    'Look up'
                  )}
                </button>
              </div>
              {manualError && (
                <p className="text-xs text-red-400 mt-1.5">{manualError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'done' && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground/70">
              <kbd className="px-1 py-0.5 bg-secondary rounded text-muted-foreground">Enter</kbd> or{' '}
              <kbd className="px-1 py-0.5 bg-secondary rounded text-muted-foreground ml-1">Esc</kbd> to close
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-sm transition"
            >
              Done
            </button>
          </div>
        )}

        {phase === 'review' && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground/70">
              <kbd className="px-1 py-0.5 bg-secondary rounded text-muted-foreground">j/k</kbd> navigate{' '}
              <kbd className="px-1 py-0.5 bg-secondary rounded text-muted-foreground ml-1">Enter</kbd> toggle{' '}
              <kbd className="px-1 py-0.5 bg-secondary rounded text-muted-foreground ml-1">Cmd+Enter</kbd> sync
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition"
              >
                Skip All
              </button>
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sync Selected ({selected.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
