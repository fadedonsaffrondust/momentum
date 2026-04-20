import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  JarvisConversationDetail,
  JarvisConversationSummary,
  JarvisCreateConversationInput,
  JarvisCreateConversationResponse,
} from '@momentum/shared';
import { apiFetch, SHARED_STALE_TIME, useToken } from '../../api/hooks/_shared';

/**
 * TanStack Query hooks for the /api/jarvis conversation endpoints.
 * Naming matches the domain-per-file convention under
 * `apps/web/src/api/hooks/`. Query-key factory is scoped to the Jarvis
 * feature folder — all Jarvis keys live here so future feature work
 * stays in one place.
 */

export const jarvisKeys = {
  all: ['jarvis'] as const,
  conversations: ['jarvis', 'conversations'] as const,
  conversation: (id: string | undefined) => ['jarvis', 'conversations', id] as const,
};

export function useJarvisConversations() {
  const token = useToken();
  return useQuery({
    queryKey: jarvisKeys.conversations,
    queryFn: () => apiFetch<JarvisConversationSummary[]>('/api/jarvis/conversations', { token }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useJarvisConversation(id: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: jarvisKeys.conversation(id),
    queryFn: () => apiFetch<JarvisConversationDetail>(`/api/jarvis/conversations/${id}`, { token }),
    enabled: !!token && !!id,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useCreateJarvisConversation() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JarvisCreateConversationInput) =>
      apiFetch<JarvisCreateConversationResponse>('/api/jarvis/conversations', {
        method: 'POST',
        body: input,
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: jarvisKeys.conversations }),
  });
}

export function useDeleteJarvisConversation() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/jarvis/conversations/${id}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: jarvisKeys.conversations });
      qc.removeQueries({ queryKey: jarvisKeys.conversation(id) });
    },
  });
}
