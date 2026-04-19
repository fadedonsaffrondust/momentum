import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DailyLog, UpsertDailyLogInput } from '@momentum/shared';
import { apiFetch, dailyLogKeys, useToken } from './_shared';

export function useDailyLogs(limit = 30) {
  const token = useToken();
  return useQuery({
    queryKey: dailyLogKeys.list(limit),
    queryFn: () => apiFetch<DailyLog[]>('/daily-logs', { token, query: { limit } }),
    enabled: !!token,
  });
}

export function useUpsertDailyLog() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertDailyLogInput) =>
      apiFetch<DailyLog>('/daily-logs', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: dailyLogKeys.all }),
  });
}
