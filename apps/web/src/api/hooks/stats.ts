import { useQuery } from '@tanstack/react-query';
import type { TeamTodayStats, TeamWeeklyStats, WeeklyStats } from '@momentum/shared';
import { apiFetch, SHARED_STALE_TIME, statsKeys, useToken } from './_shared';

export function useWeeklyStats() {
  const token = useToken();
  return useQuery({
    queryKey: statsKeys.weekly,
    queryFn: () => apiFetch<WeeklyStats>('/stats/weekly', { token }),
    enabled: !!token,
  });
}

export function useTeamWeeklyStats() {
  const token = useToken();
  return useQuery({
    queryKey: statsKeys.teamWeekly,
    queryFn: () => apiFetch<TeamWeeklyStats>('/stats/team-weekly', { token }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useTeamTodayStats() {
  const token = useToken();
  return useQuery({
    queryKey: statsKeys.teamToday,
    queryFn: () => apiFetch<TeamTodayStats>('/stats/team-today', { token }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
  });
}
