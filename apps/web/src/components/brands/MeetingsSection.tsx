import { useMemo, useState } from 'react';
import type { BrandMeeting, BrandStakeholder } from '@momentum/shared';
import { useDeleteBrandMeeting, useCreateBrandActionItem } from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { extractActionItems } from '../../lib/extractActionItems';
import { formatDateShort } from '../../lib/format';
import { ChevronDown, ChevronRight, Pencil, Trash2, Zap } from 'lucide-react';
import { MeetingNoteModal } from './MeetingNoteModal';
import { confirm } from '../ConfirmModal';

interface Props {
  brandId: string;
  meetings: BrandMeeting[];
  stakeholders: BrandStakeholder[];
}

export function MeetingsSection({ brandId, meetings, stakeholders }: Props) {
  const [collapsed, setCollapsed] = useState(true);
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
      <section className="px-6 py-4">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 w-full text-left group"
        >
          {collapsed ? (
            <ChevronRight size={14} className="text-zinc-600" />
          ) : (
            <ChevronDown size={14} className="text-zinc-600" />
          )}
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold group-hover:text-zinc-300 transition">
            Meetings
            <span className="ml-1 text-zinc-600">({meetings.length})</span>
          </h2>
        </button>

        {!collapsed && (
          <div className="mt-3 space-y-2 animate-slideUp">
            {sorted.length === 0 && (
              <p className="text-xs text-zinc-600 py-4 text-center">No meetings logged yet.</p>
            )}
            {sorted.map((m) => {
              const isExpanded = expandedId === m.id;
              const initials = m.attendees
                .map((a) => a.slice(0, 1).toUpperCase())
                .join('');

              return (
                <div
                  key={m.id}
                  className="border border-zinc-900 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900/30 transition"
                  >
                    <span className="text-xs font-mono text-zinc-500 shrink-0 w-20">
                      {formatDateShort(m.date)}
                    </span>
                    <span className="flex-1 text-sm text-zinc-200 truncate">
                      {m.title}
                    </span>
                    {initials && (
                      <span className="text-[10px] text-zinc-600 shrink-0">
                        {initials}
                      </span>
                    )}
                    {m.summary && (
                      <span className="hidden md:block text-xs text-zinc-600 truncate max-w-[200px]">
                        {m.summary}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-zinc-600 shrink-0" />
                    ) : (
                      <ChevronRight size={12} className="text-zinc-600 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-zinc-900 space-y-3 animate-slideUp">
                      {m.summary && (
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                            Summary
                          </span>
                          <p className="text-xs text-zinc-400 mt-0.5">{m.summary}</p>
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                          Notes
                        </span>
                        <pre className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap font-mono leading-relaxed">
                          {m.rawNotes || '(empty)'}
                        </pre>
                      </div>

                      {m.decisions.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                            Decisions
                          </span>
                          <ul className="mt-1 space-y-0.5">
                            {m.decisions.map((d, i) => (
                              <li key={i} className="text-xs text-zinc-400">
                                • {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => void handleExtractActions(m)}
                          className="flex items-center gap-1 text-xs text-accent hover:underline"
                          title="Re-extract action items from notes"
                        >
                          <Zap size={12} /> Extract action items
                        </button>
                        <button
                          onClick={() => setEditingMeeting(m)}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirm(`Delete meeting "${m.title}"?`)) {
                              deleteMeeting.mutate(m.id);
                            }
                          }}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
