import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BrandMeeting, BrandStakeholder } from '@momentum/shared';
import {
  useCreateBrandMeeting,
  useUpdateBrandMeeting,
  useCreateBrandActionItem,
} from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { todayIso } from '../../lib/date';
import { extractActionItems } from '../../lib/extractActionItems';
import { useSmartTextarea } from '../../hooks/useSmartTextarea';
import { confirm } from '../ConfirmModal';
import { X } from 'lucide-react';

interface Props {
  brandId: string;
  stakeholders: BrandStakeholder[];
  existingMeeting?: BrandMeeting;
  pastTitles: string[];
  onClose: () => void;
}

export function MeetingNoteModal({
  brandId,
  stakeholders,
  existingMeeting,
  pastTitles,
  onClose,
}: Props) {
  const isEdit = !!existingMeeting;
  const createMeeting = useCreateBrandMeeting(brandId);
  const updateMeeting = useUpdateBrandMeeting(brandId);
  const createActionItem = useCreateBrandActionItem(brandId);
  const pushToast = useUiStore((s) => s.pushToast);

  const [date, setDate] = useState(existingMeeting?.date ?? todayIso());
  const [title, setTitle] = useState(existingMeeting?.title ?? '');
  const [attendeeInput, setAttendeeInput] = useState('');
  const [attendees, setAttendees] = useState<string[]>(existingMeeting?.attendees ?? []);
  const [attendeeHighlight, setAttendeeHighlight] = useState(0);
  const [notes, setNotes] = useState(existingMeeting?.rawNotes ?? '');
  const [decisions, setDecisions] = useState(existingMeeting?.decisions?.join('\n') ?? '');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [titleHighlight, setTitleHighlight] = useState(0);
  const [dirty, setDirty] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const smartNotes = useSmartTextarea({
    value: notes,
    onChange: (v) => {
      setNotes(v);
      markDirty();
    },
  });

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const markDirty = () => {
    if (!dirty) setDirty(true);
  };

  const addAttendee = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !attendees.includes(trimmed)) {
      setAttendees((prev) => [...prev, trimmed]);
      markDirty();
    }
    setAttendeeInput('');
  };

  const removeAttendee = (name: string) => {
    setAttendees((prev) => prev.filter((a) => a !== name));
    markDirty();
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    markDirty();
    if (val.length >= 2) {
      const q = val.toLowerCase();
      const unique = [...new Set(pastTitles)].filter((t) => t.toLowerCase().includes(q));
      setTitleSuggestions(unique.slice(0, 5));
    } else {
      setTitleSuggestions([]);
    }
    setTitleHighlight(0);
  };

  const pickTitleSuggestion = (s: string) => {
    setTitle(s);
    setTitleSuggestions([]);
    setTitleHighlight(0);
    markDirty();
  };

  const stakeholderNames = stakeholders.map((s) => s.name);
  const attendeeSuggestions =
    attendeeInput.length >= 1
      ? stakeholderNames.filter(
          (n) => n.toLowerCase().includes(attendeeInput.toLowerCase()) && !attendees.includes(n),
        )
      : [];

  useEffect(() => {
    setAttendeeHighlight(0);
  }, [attendeeInput, attendees.length]);

  const save = async () => {
    if (!title.trim()) {
      pushToast({ kind: 'error', message: 'Title is required', durationMs: 3000 });
      return;
    }

    const decisionsList = decisions
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);

    try {
      if (isEdit && existingMeeting) {
        await updateMeeting.mutateAsync({
          id: existingMeeting.id,
          date,
          title: title.trim(),
          attendees,
          rawNotes: notes,
          decisions: decisionsList,
        });
        pushToast({ kind: 'success', message: 'Meeting updated', durationMs: 2500 });
      } else {
        const meeting = await createMeeting.mutateAsync({
          date,
          title: title.trim(),
          attendees,
          rawNotes: notes,
          decisions: decisionsList,
        });

        const extracted = extractActionItems(notes);
        if (extracted.length > 0) {
          for (const text of extracted) {
            await createActionItem.mutateAsync({ text, meetingId: meeting.id });
          }
          pushToast({
            kind: 'success',
            message: `Meeting saved — ${extracted.length} action item${extracted.length > 1 ? 's' : ''} extracted`,
            durationMs: 4000,
          });
        } else {
          pushToast({ kind: 'success', message: 'Meeting saved', durationMs: 2500 });
        }
      }
      onClose();
    } catch {
      pushToast({ kind: 'error', message: 'Failed to save meeting', durationMs: 4000 });
    }
  };

  const handleClose = async () => {
    if (dirty && !(await confirm('Discard unsaved changes?'))) return;
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/70 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-4xl my-12 mx-4 rounded-2xl border border-border bg-background shadow-2xl animate-scaleIn"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void save();
          }
        }}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h2 className="text-sm text-foreground">
            {isEdit ? 'Edit Meeting Note' : 'New Meeting Note'}
          </h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  markDirty();
                }}
                className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </label>

            <label className="block relative">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Title
              </span>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (titleSuggestions.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setTitleHighlight((i) => (i + 1) % titleSuggestions.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setTitleHighlight(
                      (i) => (i - 1 + titleSuggestions.length) % titleSuggestions.length,
                    );
                  } else if (e.key === 'Enter') {
                    const picked = titleSuggestions[titleHighlight];
                    if (picked) {
                      e.preventDefault();
                      pickTitleSuggestion(picked);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setTitleSuggestions([]);
                  }
                }}
                placeholder="e.g. Weekly sync"
                className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              />
              {titleSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 border border-border bg-background rounded-lg shadow-xl py-1 max-h-40 overflow-y-auto">
                  {titleSuggestions.map((s, i) => (
                    <li key={s}>
                      <button
                        type="button"
                        onMouseEnter={() => setTitleHighlight(i)}
                        onClick={() => pickTitleSuggestion(s)}
                        className={clsx(
                          'w-full text-left px-3 py-1.5 text-xs text-foreground',
                          i === titleHighlight ? 'bg-secondary' : 'hover:bg-secondary',
                        )}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
          </div>

          {/* Attendees chip input */}
          <div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Attendees
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-2 min-h-[40px]">
              {attendees.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                >
                  {a}
                  <button
                    onClick={() => removeAttendee(a)}
                    className="hover:text-red-400"
                    aria-label={`Remove ${a}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="relative flex-1 min-w-[100px]">
                <input
                  type="text"
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' && attendeeSuggestions.length > 0) {
                      e.preventDefault();
                      setAttendeeHighlight((i) => (i + 1) % attendeeSuggestions.length);
                      return;
                    }
                    if (e.key === 'ArrowUp' && attendeeSuggestions.length > 0) {
                      e.preventDefault();
                      setAttendeeHighlight(
                        (i) => (i - 1 + attendeeSuggestions.length) % attendeeSuggestions.length,
                      );
                      return;
                    }
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const picked = attendeeSuggestions[attendeeHighlight];
                      addAttendee(picked ?? attendeeInput);
                      return;
                    }
                    if (e.key === 'Backspace' && !attendeeInput && attendees.length > 0) {
                      removeAttendee(attendees[attendees.length - 1]!);
                    }
                  }}
                  placeholder={attendees.length === 0 ? 'Type a name…' : ''}
                  className="w-full bg-transparent text-xs text-foreground focus:outline-none"
                />
                {attendeeSuggestions.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-2 border border-border bg-background rounded-lg shadow-xl py-1 max-h-32 overflow-y-auto">
                    {attendeeSuggestions.map((s, i) => (
                      <li key={s}>
                        <button
                          type="button"
                          onMouseEnter={() => setAttendeeHighlight(i)}
                          onClick={() => addAttendee(s)}
                          className={clsx(
                            'w-full text-left px-3 py-1.5 text-xs text-foreground',
                            i === attendeeHighlight ? 'bg-secondary' : 'hover:bg-secondary',
                          )}
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Notes
            </span>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 mb-1">
              Type <code className="text-muted-foreground">/todo</code> for action items.{' '}
              <code className="text-muted-foreground">- </code> or{' '}
              <code className="text-muted-foreground">1. </code> for lists.{' '}
              <code className="text-muted-foreground">Tab</code> to indent.
            </p>
            <textarea
              value={notes}
              onChange={smartNotes.onChange}
              onKeyDown={smartNotes.onKeyDown}
              rows={10}
              placeholder="Meeting notes…"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-y font-mono"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Decisions <span className="text-muted-foreground/70">(optional)</span>
            </span>
            <textarea
              value={decisions}
              onChange={(e) => {
                setDecisions(e.target.value);
                markDirty();
              }}
              rows={3}
              placeholder="One decision per line…"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-y"
            />
          </label>
        </div>

        <footer className="flex items-center justify-between px-6 py-4 border-t border-border/60">
          <span className="text-[10px] text-muted-foreground/70">
            <kbd className="px-1 py-0.5 rounded border border-border bg-card text-muted-foreground font-mono text-[9px]">
              ⌘ Enter
            </kbd>{' '}
            to save
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition"
            >
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={createMeeting.isPending || updateMeeting.isPending}
              className="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 text-sm transition disabled:opacity-50"
            >
              {isEdit ? 'Update' : 'Save Meeting'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
