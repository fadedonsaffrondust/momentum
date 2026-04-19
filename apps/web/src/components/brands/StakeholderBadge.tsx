import { useMemo } from 'react';
import type { BrandStakeholder } from '@momentum/shared';

const BADGE_COLORS = [
  '#0FB848',
  '#F7B24F',
  '#4FD1C5',
  '#F76C6C',
  '#B184F7',
  '#4F8EF7',
  '#F78FB3',
  '#FFD93D',
];

interface Props {
  stakeholder: BrandStakeholder;
  index: number;
  lastMentionDate?: string | null;
  onClick?: () => void;
}

export function StakeholderBadge({ stakeholder, index, lastMentionDate, onClick }: Props) {
  const color = BADGE_COLORS[index % BADGE_COLORS.length]!;
  const initials = useMemo(() => {
    const parts = stakeholder.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    return stakeholder.name.slice(0, 2).toUpperCase();
  }, [stakeholder.name]);

  const tooltip = [
    stakeholder.name,
    stakeholder.role ? `(${stakeholder.role})` : '',
    lastMentionDate ? `Last mentioned: ${lastMentionDate}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="group relative flex items-center justify-center w-10 h-10 rounded-full text-xs font-semibold transition hover:ring-2 hover:ring-offset-1 hover:ring-offset-background"
      style={{
        backgroundColor: color + '22',
        color,
        borderColor: color + '44',
        // @ts-expect-error -- CSS variable for hover ring
        '--tw-ring-color': color + '66',
      }}
    >
      {initials}
    </button>
  );
}
