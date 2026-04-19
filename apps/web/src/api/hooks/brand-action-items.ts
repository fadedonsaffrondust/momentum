import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BrandActionItem,
  BrandActionStatus,
  CreateBrandActionItemInput,
  SendActionItemToTodayInput,
  Task,
  UpdateBrandActionItemInput,
} from '@momentum/shared';
import { apiFetch, brandKeys, inboxKeys, SHARED_STALE_TIME, taskKeys, useToken } from './_shared';

export function useBrandActionItems(
  brandId: string | undefined,
  params: { status?: BrandActionStatus } = {},
) {
  const token = useToken();
  return useQuery({
    queryKey: brandKeys.actionItems(brandId, params),
    queryFn: () =>
      apiFetch<BrandActionItem[]>(`/brands/${brandId}/action-items`, {
        token,
        query: { ...params },
      }),
    enabled: !!token && !!brandId,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useAllBrandActionItems(brandIds: string[]) {
  const token = useToken();
  return useQueries({
    queries: brandIds.map((id) => ({
      queryKey: brandKeys.actionItemsAll(id),
      queryFn: () => apiFetch<BrandActionItem[]>(`/brands/${id}/action-items`, { token }),
      enabled: !!token,
      staleTime: SHARED_STALE_TIME,
    })),
  });
}

export function useCreateBrandActionItem(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBrandActionItemInput) =>
      apiFetch<BrandActionItem>(`/brands/${brandId}/action-items`, {
        method: 'POST',
        body: input,
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.actionItems(brandId) });
      qc.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useUpdateBrandActionItem(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBrandActionItemInput & { id: string }) =>
      apiFetch<BrandActionItem>(`/brands/${brandId}/action-items/${id}`, {
        method: 'PATCH',
        body: input,
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.actionItems(brandId) });
      qc.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useDeleteBrandActionItem(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/brands/${brandId}/action-items/${id}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.actionItems(brandId) }),
  });
}

export function useSendActionItemToToday(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: SendActionItemToTodayInput & { id: string }) =>
      apiFetch<{ actionItem: BrandActionItem; task: Task }>(
        `/brands/${brandId}/action-items/${id}/send-to-today`,
        { method: 'POST', body: input, token },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.actionItems(brandId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useCompleteBrandActionItem(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<BrandActionItem>(`/brands/${brandId}/action-items/${id}/complete`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.actionItems(brandId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
