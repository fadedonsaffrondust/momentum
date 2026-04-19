import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Brand,
  BrandEvent,
  BrandImportInput,
  BrandImportResponse,
  BrandMeeting,
  BrandStakeholder,
  CreateBrandInput,
  CreateBrandMeetingInput,
  CreateBrandStakeholderInput,
  UpdateBrandInput,
  UpdateBrandMeetingInput,
  UpdateBrandStakeholderInput,
} from '@momentum/shared';
import {
  apiFetch,
  brandKeys,
  type BrandEventsQueryParams,
  SHARED_STALE_TIME,
  useToken,
} from './_shared';

/* ─────────────── core CRUD ─────────────── */

export function useBrands() {
  const token = useToken();
  return useQuery({
    queryKey: brandKeys.all,
    queryFn: () => apiFetch<Brand[]>('/brands', { token }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
    // Same refresh cadence as the per-brand detail query: poll every 3s
    // while *any* brand in the list is still importing. This replaces the
    // old manual setInterval in BrandsPage.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.some((b) => b.status === 'importing') ? 3000 : false;
    },
  });
}

export function useBrand(id: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: brandKeys.detail(id),
    queryFn: () => apiFetch<Brand>(`/brands/${id}`, { token }),
    enabled: !!token && !!id,
    staleTime: SHARED_STALE_TIME,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'importing' ? 3000 : false;
    },
  });
}

export function useCreateBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBrandInput) =>
      apiFetch<Brand>('/brands', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

export function useUpdateBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBrandInput & { id: string }) =>
      apiFetch<Brand>(`/brands/${id}`, { method: 'PATCH', body: input, token }),
    onSuccess: (data) => {
      qc.setQueryData(brandKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: brandKeys.all });
    },
  });
}

export function useDeleteBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/brands/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

export function useImportBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BrandImportInput) =>
      apiFetch<BrandImportResponse>('/brands/import', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

/* ─────────────── stakeholders ─────────────── */

export function useBrandStakeholders(brandId: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: brandKeys.stakeholders(brandId),
    queryFn: () => apiFetch<BrandStakeholder[]>(`/brands/${brandId}/stakeholders`, { token }),
    enabled: !!token && !!brandId,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useCreateBrandStakeholder(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBrandStakeholderInput) =>
      apiFetch<BrandStakeholder>(`/brands/${brandId}/stakeholders`, {
        method: 'POST',
        body: input,
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.stakeholders(brandId) }),
  });
}

export function useUpdateBrandStakeholder(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBrandStakeholderInput & { id: string }) =>
      apiFetch<BrandStakeholder>(`/brands/${brandId}/stakeholders/${id}`, {
        method: 'PATCH',
        body: input,
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.stakeholders(brandId) }),
  });
}

export function useDeleteBrandStakeholder(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/brands/${brandId}/stakeholders/${id}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.stakeholders(brandId) }),
  });
}

/* ─────────────── meetings ─────────────── */

export function useBrandMeetings(brandId: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: brandKeys.meetings(brandId),
    queryFn: () => apiFetch<BrandMeeting[]>(`/brands/${brandId}/meetings`, { token }),
    enabled: !!token && !!brandId,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useAllBrandMeetings(brandIds: string[]) {
  const token = useToken();
  return useQueries({
    queries: brandIds.map((id) => ({
      queryKey: brandKeys.meetings(id),
      queryFn: () => apiFetch<BrandMeeting[]>(`/brands/${id}/meetings`, { token }),
      enabled: !!token,
      staleTime: SHARED_STALE_TIME,
    })),
  });
}

export function useCreateBrandMeeting(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBrandMeetingInput) =>
      apiFetch<BrandMeeting>(`/brands/${brandId}/meetings`, {
        method: 'POST',
        body: input,
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.meetings(brandId) }),
  });
}

export function useUpdateBrandMeeting(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBrandMeetingInput & { id: string }) =>
      apiFetch<BrandMeeting>(`/brands/${brandId}/meetings/${id}`, {
        method: 'PATCH',
        body: input,
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.meetings(brandId) }),
  });
}

export function useDeleteBrandMeeting(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/brands/${brandId}/meetings/${id}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.meetings(brandId) }),
  });
}

/* ─────────────── events (per-brand activity timeline) ─────────────── */

export function useBrandEvents(brandId: string | undefined, params: BrandEventsQueryParams = {}) {
  const token = useToken();
  return useQuery({
    queryKey: brandKeys.events(brandId, params),
    queryFn: () =>
      apiFetch<BrandEvent[]>(`/brands/${brandId}/events`, {
        token,
        query: { ...params },
      }),
    enabled: !!token && !!brandId,
    staleTime: SHARED_STALE_TIME,
  });
}
