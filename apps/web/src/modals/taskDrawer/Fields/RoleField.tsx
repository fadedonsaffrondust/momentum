import { useMemo } from 'react';
import type { Role } from '@momentum/shared';
import { PropertyPicker, type PropertyPickerItem } from '../../../components/PropertyPicker';
import { FieldRow } from '../FieldRow';

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
  roles: Role[];
}

export function RoleField({ value, onChange, roles }: Props) {
  const items = useMemo<PropertyPickerItem[]>(
    () => [
      {
        value: '',
        label: 'No role',
        leading: <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />,
      },
      ...roles.map((r) => ({
        value: r.id,
        label: r.name,
        leading: (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
        ),
      })),
    ],
    [roles],
  );

  const selected = roles.find((r) => r.id === value);

  return (
    <FieldRow label="Role">
      <PropertyPicker
        items={items}
        value={value ?? ''}
        onChange={(v) => onChange(v || null)}
        searchable={roles.length > 5}
        searchPlaceholder="Search roles…"
        emptyLabel="No roles."
      >
        {selected ? (
          <>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selected.color }}
            />
            <span className="truncate" style={{ color: selected.color }}>
              {selected.name}
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <span className="text-muted-foreground truncate">No role</span>
          </>
        )}
      </PropertyPicker>
    </FieldRow>
  );
}
