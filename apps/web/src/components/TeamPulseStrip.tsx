import { useTeamTodayStats } from '../api/hooks';

/**
 * Quiet team-pulse strip for the EOD Review modal (spec §9.9). Shows the
 * team's today completion rate + a count of teammates still working.
 * Intentionally subtle — it sits below the user's personal summary
 * without competing for attention.
 *
 * Renders nothing while loading or on error so the modal layout doesn't
 * jitter.
 */
export function TeamPulseStrip() {
  const statsQ = useTeamTodayStats();
  if (!statsQ.data) return null;

  const { teamCompletionRate, usersWithInProgressCount } = statsQ.data;
  const pct = Math.round(teamCompletionRate * 100);

  return (
    <div className="mt-4 pt-3 border-t border-m-border-subtle flex items-center justify-between text-[11px] text-m-fg-muted">
      <span>
        Team today:{' '}
        <span className="text-m-fg-secondary font-medium">{pct}% completion</span>
      </span>
      <span>
        {usersWithInProgressCount === 0
          ? 'Nobody currently working'
          : `${usersWithInProgressCount} teammate${
              usersWithInProgressCount === 1 ? '' : 's'
            } still working`}
      </span>
    </div>
  );
}
