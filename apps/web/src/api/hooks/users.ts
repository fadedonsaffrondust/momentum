import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, UpdateMeInput, UserSummary } from '@momentum/shared';
import { apiFetch, meKeys, SHARED_STALE_TIME, useToken, userKeys } from './_shared';

export function useUsers() {
  const token = useToken();
  return useQuery({
    queryKey: userKeys.all,
    queryFn: () => apiFetch<UserSummary[]>('/users', { token }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useUser(id: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => apiFetch<UserSummary>(`/users/${id}`, { token }),
    enabled: !!token && !!id,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useUpdateMe() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMeInput) =>
      apiFetch<AuthUser>('/users/me', { method: 'PATCH', body: input, token }),
    onSuccess: (data) => {
      qc.setQueryData(meKeys.detail(token), data);
      qc.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
