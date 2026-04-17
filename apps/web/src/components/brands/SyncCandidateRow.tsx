import type { SyncCandidate } from '@momentum/shared';

interface Props {
  candidate: SyncCandidate;
  checked: boolean;
  focused: boolean;
  onToggle: () => void;
}

export function SyncCandidateRow({ candidate, checked, focused, onToggle }: Props) {
  const { meeting, reasons, confidence } = candidate;
  const date = new Date(meeting.happenedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = new Date(meeting.happenedAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const attendeeNames = meeting.invitees
    .map((i) => i.name || i.email.split('@')[0])
    .filter(Boolean)
    .slice(0, 5);

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg border transition ${
        focused
          ? 'border-accent/50 bg-accent/5'
          : 'border-m-border/50 hover:bg-m-surface-40'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 shrink-0 accent-accent"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-m-fg-strong truncate">
            {meeting.name}
          </span>
          <span
            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              confidence === 'high'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {confidence === 'high' ? 'Likely' : 'Possible'}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-m-fg-muted">
          <span>{date} at {time}</span>
          {meeting.duration != null && (
            <span>{Math.round(meeting.duration / 60)} min</span>
          )}
        </div>

        {attendeeNames.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {attendeeNames.map((name, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded bg-m-surface-raised text-m-fg-tertiary"
              >
                {name}
              </span>
            ))}
            {meeting.invitees.length > 5 && (
              <span className="text-[10px] text-m-fg-dim">
                +{meeting.invitees.length - 5} more
              </span>
            )}
          </div>
        )}

        {reasons.length > 0 && (
          <div className="mt-1.5 text-[11px] text-m-fg-muted italic">
            {reasons.slice(0, 2).join(' · ')}
          </div>
        )}
      </div>
    </button>
  );
}
