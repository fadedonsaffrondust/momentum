import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SyncCandidate,
  SyncCandidatesResponse,
  SyncConfirmResponse,
  UpdateSyncConfigInput,
} from '@momentum/shared';
import { apiFetch, brandKeys, useToken } from './_shared';

export function useFetchSyncCandidates(brandId: string) {
  const token = useToken();
  return useMutation({
    mutationFn: () =>
      apiFetch<SyncCandidatesResponse>(`/brands/${brandId}/sync/candidates`, {
        method: 'POST',
        token,
      }),
  });
}

export function useLookupMeeting(brandId: string) {
  const token = useToken();
  return useMutation({
    mutationFn: (meetingRef: string) =>
      apiFetch<SyncCandidate>(`/brands/${brandId}/sync/lookup`, {
        method: 'POST',
        body: { meetingRef },
        token,
      }),
  });
}

export function useConfirmSync(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meetingIds: string[]) =>
      apiFetch<SyncConfirmResponse>(`/brands/${brandId}/sync/confirm`, {
        method: 'POST',
        body: { meetingIds },
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.meetings(brandId) });
      qc.invalidateQueries({ queryKey: brandKeys.actionItems(brandId) });
      qc.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
      qc.invalidateQueries({ queryKey: brandKeys.all });
    },
  });
}

export function useUpdateSyncConfig(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSyncConfigInput) =>
      apiFetch<{ ok: true }>(`/brands/${brandId}/sync/config`, {
        method: 'PATCH',
        body: input,
        token,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
    },
  });
}
