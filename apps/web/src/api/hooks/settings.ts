import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateSettingsInput, UserSettings } from '@momentum/shared';
import { apiFetch, settingsKeys, useToken } from './_shared';

export function useSettings() {
  const token = useToken();
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => apiFetch<UserSettings>('/settings', { token }),
    enabled: !!token,
  });
}

export function useUpdateSettings() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) =>
      apiFetch<UserSettings>('/settings', { method: 'PUT', body: input, token }),
    onSuccess: (data) => qc.setQueryData(settingsKeys.all, data),
  });
}
