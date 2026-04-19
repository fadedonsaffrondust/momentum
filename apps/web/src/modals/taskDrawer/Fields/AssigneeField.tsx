import { useMemo } from 'react';
import type { UserSummary } from '@momentum/shared';
import { Avatar } from '../../../components/Avatar';
import { PropertyPicker, type PropertyPickerItem } from '../../../components/PropertyPicker';
import { FieldRow } from '../FieldRow';

interface Props {
  value: string;
  onChange: (next: string) => void;
  users: UserSummary[];
  meId: string | undefined;
}

export function AssigneeField({ value, onChange, users, meId }: Props) {
  const items = useMemo<PropertyPickerItem[]>(
    () =>
      users.map((u) => ({
        value: u.id,
        label: u.displayName || u.email,
        leading: <Avatar user={u} size="xs" showTooltip={false} />,
        hint: u.id === meId ? 'you' : undefined,
        keywords: [u.email],
      })),
    [users, meId],
  );

  const assignee = users.find((u) => u.id === value);

  return (
    <FieldRow label="Assignee">
      <PropertyPicker
        items={items}
        value={value}
        onChange={onChange}
        searchable={users.length > 5}
        searchPlaceholder="Search team…"
        emptyLabel="No teammates."
      >
        {assignee ? (
          <>
            <Avatar user={assignee} size="xs" showTooltip={false} />
            <span className="text-foreground truncate">
              {assignee.displayName || assignee.email}
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-dashed border-border text-[9px] text-muted-foreground/70 shrink-0">
              ?
            </span>
            <span className="text-muted-foreground truncate">Unassigned</span>
          </>
        )}
      </PropertyPicker>
    </FieldRow>
  );
}
