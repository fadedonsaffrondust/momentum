import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BrandFeatureRequest,
  ConnectSheetInput,
  ConnectSheetResponse,
  ConvertFeatureRequestResponse,
  CreateBrandFeatureRequestInput,
  SheetSyncPullResponse,
  SheetSyncPushResponse,
  UpdateBrandFeatureRequestInput,
} from '@momentum/shared';
import {
  apiFetch,
  brandKeys,
  type FeatureRequestsQueryParams,
  SHARED_STALE_TIME,
  useToken,
} from './_shared';

export type { FeatureRequestsQueryParams } from './_shared';

export function useBrandFeatureRequests(
  brandId: string | undefined,
  params: FeatureRequestsQueryParams = {},
) {
  const token = useToken();
  return useQuery({
    queryKey: brandKeys.featureRequests(brandId, params),
    queryFn: () =>
      apiFetch<BrandFeatureRequest[]>(`/brands/${brandId}/feature-requests`, {
        token,
        query: { ...params },
      }),
    enabled: !!token && !!brandId,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useCreateBrandFeatureRequest(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBrandFeatureRequestInput) =>
      apiFetch<BrandFeatureRequest>(`/brands/${brandId}/feature-requests`, {
        method: 'POST',
        body: input,
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.featureRequests(brandId) }),
  });
}

export function useUpdateBrandFeatureRequest(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBrandFeatureRequestInput & { id: string }) =>
      apiFetch<BrandFeatureRequest>(`/brands/${brandId}/feature-requests/${id}`, {
        method: 'PATCH',
        body: input,
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.featureRequests(brandId) }),
  });
}

export function useDeleteBrandFeatureRequest(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/brands/${brandId}/feature-requests/${id}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.featureRequests(brandId) }),
  });
}

export function useConnectFeatureRequestSheet(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectSheetInput) =>
      apiFetch<ConnectSheetResponse>(`/brands/${brandId}/feature-requests/connect-sheet`, {
        method: 'POST',
        body: input,
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
      qc.invalidateQueries({ queryKey: brandKeys.featureRequests(brandId) });
    },
  });
}

export function useDisconnectFeatureRequestSheet(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>(`/brands/${brandId}/feature-requests/disconnect-sheet`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
      qc.invalidateQueries({ queryKey: brandKeys.featureRequests(brandId) });
    },
  });
}

export function usePullFeatureRequests(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<SheetSyncPullResponse>(`/brands/${brandId}/feature-requests/sync/pull`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.featureRequests(brandId) });
      qc.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
    },
  });
}

export function usePushFeatureRequests(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<SheetSyncPushResponse>(`/brands/${brandId}/feature-requests/sync/push`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.featureRequests(brandId) });
      qc.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
    },
  });
}

export function useConvertFeatureRequestToAction(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ConvertFeatureRequestResponse>(
        `/brands/${brandId}/feature-requests/${id}/convert-to-action`,
        { method: 'POST', token },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.featureRequests(brandId) });
      qc.invalidateQueries({ queryKey: brandKeys.actionItems(brandId) });
    },
  });
}
