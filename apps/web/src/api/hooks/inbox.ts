import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InboxEvent } from '@momentum/shared';
import { apiFetch, inboxKeys, type InboxQueryParams, SHARED_STALE_TIME, useToken } from './_shared';

export type { InboxQueryParams } from './_shared';

export function useInbox(params: InboxQueryParams = {}) {
  const token = useToken();
  return useQuery({
    queryKey: inboxKeys.list(params),
    queryFn: () =>
      apiFetch<InboxEvent[]>('/inbox', {
        token,
        query: { ...params },
      }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
  });
}

/**
 * Cheap badge query. Polls every 30s so the sidebar Inbox pill updates
 * without requiring user interaction (spec §9.2).
 */
export function useInboxUnreadCount() {
  const token = useToken();
  return useQuery({
    queryKey: inboxKeys.unreadCount,
    queryFn: () => apiFetch<{ count: number }>('/inbox/unread-count', { token }),
    enabled: !!token,
    refetchInterval: 30_000,
  });
}

export function useMarkInboxRead() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/inbox/${id}/read`, { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}

export function useMarkAllInboxRead() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ updated: number }>('/inbox/read-all', { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}
