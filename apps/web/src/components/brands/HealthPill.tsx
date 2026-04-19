import clsx from 'clsx';
import type { HealthStatus } from '../../hooks/useBrandHealth';

const STATUS_CONFIG: Record<HealthStatus, { color: string; glow: string; label: string }> = {
  on_track: { color: 'bg-emerald-500', glow: 'shadow-emerald-500/40', label: 'On track' },
  quiet: { color: 'bg-amber-500', glow: 'shadow-amber-500/40', label: 'Quiet' },
  needs_attention: { color: 'bg-red-500', glow: 'shadow-red-500/40', label: 'Needs attention' },
};

interface Props {
  status: HealthStatus;
  showLabel?: boolean;
}

export function HealthPill({ status, showLabel = false }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5" title={cfg.label}>
      <span className={clsx('inline-block w-2 h-2 rounded-full shadow-sm', cfg.color, cfg.glow)} />
      {showLabel && <span className="text-xs text-foreground">{cfg.label}</span>}
    </span>
  );
}
