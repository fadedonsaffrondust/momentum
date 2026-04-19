import { todayIso } from '../../../lib/date';
import { FieldRow } from '../FieldRow';

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
}

export function ScheduleField({ value, onChange }: Props) {
  return (
    <FieldRow label="Scheduled">
      <div className="flex-1 flex items-center gap-2">
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="bg-transparent text-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(todayIso())}
          className="text-2xs text-primary hover:underline"
        >
          today
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-2xs text-muted-foreground/70 hover:text-foreground transition-colors duration-150"
          >
            unschedule
          </button>
        )}
      </div>
    </FieldRow>
  );
}
