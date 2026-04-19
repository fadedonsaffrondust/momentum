import { formatMinutes } from '../../../lib/format';
import { FieldRow } from '../FieldRow';

interface Props {
  value: number | null;
  onChange: (next: number | null) => void;
}

export function EstimateField({ value, onChange }: Props) {
  return (
    <FieldRow label="Estimate">
      <div className="flex-1 flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={5}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="minutes"
          className="w-20 bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/70"
        />
        {value !== null && value > 0 && (
          <span className="text-xs text-muted-foreground">{formatMinutes(value)}</span>
        )}
      </div>
    </FieldRow>
  );
}
