import type { Priority } from '@momentum/shared';
import { PropertyPicker, type PropertyPickerItem } from '../../../components/PropertyPicker';
import { FieldRow } from '../FieldRow';

const LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const ITEMS: PropertyPickerItem<Priority>[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

interface Props {
  value: Priority;
  onChange: (next: Priority) => void;
}

export function PriorityField({ value, onChange }: Props) {
  return (
    <FieldRow label="Priority">
      <PropertyPicker<Priority> items={ITEMS} value={value} onChange={onChange}>
        <span className="text-foreground truncate">{LABELS[value]}</span>
      </PropertyPicker>
    </FieldRow>
  );
}
