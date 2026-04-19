import { useMemo, useState } from 'react';
import type { BrandMeeting, BrandStakeholder, UserSummary } from '@momentum/shared';
import { useDeleteBrandMeeting, useCreateBrandActionItem, useUsers } from '../../../api/hooks';
import { useUiStore } from '../../../store/ui';
import { extractActionItems } from '../../../lib/extractActionItems';
import { formatDateShort } from '../../../lib/format';
import { ChevronDown, ChevronRight, Pencil, Trash2, Zap, Play } from 'lucide-react';
import { MeetingNoteModal } from '../modals/MeetingNoteModal';
import { AvatarStack } from '../../AvatarStack';
import { Avatar } from '../../Avatar';
import { confirm } from '../../ConfirmModal';

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
  const usersQ = useUsers();
  const pushToast = useUiStore((s) => s.pushToast);

  const users = usersQ.data ?? [];
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

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
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Meetings
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            ({meetings.length})
          </span>
        </h2>

        <div className="space-y-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No meetings logged yet.
            </p>
          )}
          {sorted.map((m) => {
            const isExpanded = expandedId === m.id;
            const linkedAttendees = m.attendeeUserIds
              .map((id) => usersById.get(id))
              .filter((u): u is UserSummary => u !== undefined);
            const externalCount = Math.max(0, m.attendees.length - linkedAttendees.length);

            return (
              <div key={m.id} className="border border-border/60 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/40 transition"
                >
                  <span className="text-xs font-mono text-muted-foreground shrink-0 w-20">
                    {formatDateShort(m.date)}
                  </span>
                  <span className="flex-1 text-sm text-foreground truncate">{m.title}</span>
                  {m.recordingUrl && <Play size={12} className="text-primary/60 shrink-0" />}
                  {linkedAttendees.length > 0 && (
                    <AvatarStack users={linkedAttendees} max={3} size="xs" className="shrink-0" />
                  )}
                  {externalCount > 0 && (
                    <span
                      className="text-[10px] text-muted-foreground shrink-0"
                      title={`${externalCount} external attendee${externalCount === 1 ? '' : 's'}`}
                    >
                      +{externalCount}
                    </span>
                  )}
                  {m.source === 'recording_sync' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/20 shrink-0">
                      Synced
                    </span>
                  )}
                  {m.summary && (
                    <span className="hidden md:block text-xs text-muted-foreground truncate max-w-[200px]">
                      {m.summary}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown size={12} className="text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/60 space-y-3 animate-slideUp">
                    {m.recordingUrl && (
                      <a
                        href={m.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/90 transition"
                      >
                        <Play size={14} />
                        Recording
                      </a>
                    )}

                    {m.summary && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-foreground font-semibold">
                          Summary
                        </span>
                        <p className="text-sm text-foreground mt-1">{m.summary}</p>
                      </div>
                    )}

                    {m.attendees.length > 0 && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-foreground font-semibold">
                          Attendees
                        </span>
                        <AttendeeList attendees={m.attendees} usersById={usersById} />
                      </div>
                    )}

                    <NotesSection rawNotes={m.rawNotes} />

                    {m.decisions.length > 0 && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-foreground font-semibold">
                          Decisions
                        </span>
                        <ul className="mt-1 space-y-1">
                          {m.decisions.map((d, i) => (
                            <li key={i} className="text-sm text-foreground">
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => void handleExtractActions(m)}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                        title="Re-extract action items from notes"
                      >
                        <Zap size={14} /> Extract action items
                      </button>
                      <button
                        onClick={() => setEditingMeeting(m)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirm(`Delete meeting "${m.title}"?`)) {
                            deleteMeeting.mutate(m.id);
                          }
                        }}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-400"
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

/**
 * Attendee list: team members (matched by email in attendees[] against
 * users.email) render with their Avatar + displayName; unmatched entries
 * render as plain text (spec §9.6 "for each attendee, render Avatar if
 * email matches a team user, plain text otherwise").
 */
function AttendeeList({
  attendees,
  usersById,
}: {
  attendees: readonly string[];
  usersById: Map<string, UserSummary>;
}) {
  // Build email → user map once from the roster we already have.
  const emailLookup = useMemo(() => {
    const map = new Map<string, UserSummary>();
    for (const u of usersById.values()) {
      map.set(u.email.toLowerCase(), u);
    }
    return map;
  }, [usersById]);

  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {attendees.map((entry, i) => {
        const trimmed = entry.trim();
        const maybeUser = emailLookup.get(trimmed.toLowerCase());
        if (maybeUser) {
          return (
            <li
              key={`${i}-${trimmed}`}
              className="inline-flex items-center gap-1.5 text-xs text-foreground bg-card rounded-full pl-0.5 pr-2 py-0.5"
            >
              <Avatar user={maybeUser} size="xs" showTooltip={false} />
              <span>{maybeUser.displayName || maybeUser.email}</span>
            </li>
          );
        }
        return (
          <li
            key={`${i}-${trimmed}`}
            className="inline-flex items-center text-xs text-muted-foreground bg-card/40 rounded-full px-2 py-0.5"
          >
            {trimmed}
          </li>
        );
      })}
    </ul>
  );
}

const NOTES_PREVIEW_LENGTH = 800;

function NotesSection({ rawNotes }: { rawNotes: string }) {
  const [showFull, setShowFull] = useState(false);

  if (!rawNotes) {
    return (
      <div>
        <span className="text-xs uppercase tracking-wide text-foreground font-semibold">Notes</span>
        <p className="text-sm text-muted-foreground mt-1 italic">(empty)</p>
      </div>
    );
  }

  const isLong = rawNotes.length > NOTES_PREVIEW_LENGTH;
  const displayText =
    isLong && !showFull ? rawNotes.slice(0, NOTES_PREVIEW_LENGTH) + '…' : rawNotes;

  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-foreground font-semibold">Notes</span>
      <pre className="text-sm text-foreground mt-1 whitespace-pre-wrap font-mono leading-relaxed">
        {displayText}
      </pre>
      {isLong && (
        <button
          onClick={() => setShowFull((v) => !v)}
          className="mt-1 text-sm text-primary hover:text-primary/90 transition"
        >
          {showFull ? 'Show less' : 'See full transcript'}
        </button>
      )}
    </div>
  );
}
