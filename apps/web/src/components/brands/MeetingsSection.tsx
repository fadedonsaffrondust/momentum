import { useMemo, useState } from 'react';
import type { BrandMeeting, BrandStakeholder } from '@momentum/shared';
import { useDeleteBrandMeeting, useCreateBrandActionItem } from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { extractActionItems } from '../../lib/extractActionItems';
import { formatDateShort } from '../../lib/format';
import { ChevronDown, ChevronRight, Pencil, Trash2, Zap, Play } from 'lucide-react';
import { MeetingNoteModal } from './MeetingNoteModal';
import { confirm } from '../ConfirmModal';

interface Props {
  brandId: string;
  meetings: BrandMeeting[];
  stakeholders: BrandStakeholder[];
}

export function MeetingsSection({ brandId, meetings, stakeholders }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<BrandMeeting | null>(null);
  const deleteMeeting = useDeleteBrandMeeting(brandId);
  const createActionItem = useCreateBrandActionItem(brandId);
  const pushToast = useUiStore((s) => s.pushToast);

  const sorted = useMemo(
    () => [...meetings].sort((a, b) => b.date.localeCompare(a.date)),
    [meetings],
  );

  const pastTitles = useMemo(() => sorted.map((m) => m.title), [sorted]);

  const handleExtractActions = async (meeting: BrandMeeting) => {
    const items = extractActionItems(meeting.rawNotes);
    if (items.length === 0) {
      pushToast({ kind: 'info', message: 'No action items found in notes.', durationMs: 3000 });
      return;
    }
    for (const text of items) {
      await createActionItem.mutateAsync({ text, meetingId: meeting.id });
    }
    pushToast({
      kind: 'success',
      message: `Extracted ${items.length} action item${items.length > 1 ? 's' : ''}`,
      durationMs: 3000,
    });
  };

  return (
    <>
      <section>
        <h2 className="text-sm font-semibold text-m-fg-strong mb-3">
          Meetings
          <span className="ml-2 text-xs text-m-fg-muted font-normal">
            ({meetings.length})
          </span>
        </h2>

        <div className="space-y-2">
          {sorted.length === 0 && (
            <p className="text-sm text-m-fg-muted py-4 text-center">No meetings logged yet.</p>
          )}
          {sorted.map((m) => {
            const isExpanded = expandedId === m.id;
            const initials = m.attendees
              .map((a) => a.slice(0, 1).toUpperCase())
              .join('');

            return (
              <div
                key={m.id}
                className="border border-m-border-subtle rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-m-surface-40 transition"
                >
                  <span className="text-xs font-mono text-m-fg-muted shrink-0 w-20">
                    {formatDateShort(m.date)}
                  </span>
                  <span className="flex-1 text-sm text-m-fg-strong truncate">
                    {m.title}
                  </span>
                  {m.recordingUrl && (
                    <Play size={12} className="text-accent/60 shrink-0" />
                  )}
                  {initials && (
                    <span className="text-xs text-m-fg-muted shrink-0">
                      {initials}
                    </span>
                  )}
                  {m.source === 'recording_sync' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent/70 border border-accent/20 shrink-0">
                      Synced
                    </span>
                  )}
                  {m.summary && (
                    <span className="hidden md:block text-xs text-m-fg-muted truncate max-w-[200px]">
                      {m.summary}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown size={12} className="text-m-fg-muted shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-m-fg-muted shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-m-border-subtle space-y-3 animate-slideUp">
                    {m.recordingUrl && (
                      <a
                        href={m.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition"
                      >
                        <Play size={14} />
                        Recording
                      </a>
                    )}

                    {m.summary && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-m-fg-secondary font-semibold">
                          Summary
                        </span>
                        <p className="text-sm text-m-fg-secondary mt-1">{m.summary}</p>
                      </div>
                    )}

                    <NotesSection rawNotes={m.rawNotes} />

                    {m.decisions.length > 0 && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-m-fg-secondary font-semibold">
                          Decisions
                        </span>
                        <ul className="mt-1 space-y-1">
                          {m.decisions.map((d, i) => (
                            <li key={i} className="text-sm text-m-fg-secondary">
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => void handleExtractActions(m)}
                        className="flex items-center gap-1.5 text-sm text-accent hover:underline"
                        title="Re-extract action items from notes"
                      >
                        <Zap size={14} /> Extract action items
                      </button>
                      <button
                        onClick={() => setEditingMeeting(m)}
                        className="flex items-center gap-1.5 text-sm text-m-fg-muted hover:text-m-fg-strong"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirm(`Delete meeting "${m.title}"?`)) {
                            deleteMeeting.mutate(m.id);
                          }
                        }}
                        className="flex items-center gap-1.5 text-sm text-m-fg-muted hover:text-red-400"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {editingMeeting && (
        <MeetingNoteModal
          brandId={brandId}
          stakeholders={stakeholders}
          existingMeeting={editingMeeting}
          pastTitles={pastTitles}
          onClose={() => setEditingMeeting(null)}
        />
      )}
    </>
  );
}

const NOTES_PREVIEW_LENGTH = 800;

function NotesSection({ rawNotes }: { rawNotes: string }) {
  const [showFull, setShowFull] = useState(false);

  if (!rawNotes) {
    return (
      <div>
        <span className="text-xs uppercase tracking-wide text-m-fg-secondary font-semibold">Notes</span>
        <p className="text-sm text-m-fg-muted mt-1 italic">(empty)</p>
      </div>
    );
  }

  const isLong = rawNotes.length > NOTES_PREVIEW_LENGTH;
  const displayText = isLong && !showFull
    ? rawNotes.slice(0, NOTES_PREVIEW_LENGTH) + '…'
    : rawNotes;

  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-m-fg-secondary font-semibold">Notes</span>
      <pre className="text-sm text-m-fg-secondary mt-1 whitespace-pre-wrap font-mono leading-relaxed">
        {displayText}
      </pre>
      {isLong && (
        <button
          onClick={() => setShowFull((v) => !v)}
          className="mt-1 text-sm text-accent hover:text-accent-hover transition"
        >
          {showFull ? 'Show less' : 'See full transcript'}
        </button>
      )}
    </div>
  );
}
