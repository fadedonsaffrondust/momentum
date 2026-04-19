import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateParkingInput, Parking, UpdateParkingInput } from '@momentum/shared';
import {
  apiFetch,
  inboxKeys,
  parkingKeys,
  type ParkingsQueryParams,
  SHARED_STALE_TIME,
  useToken,
} from './_shared';

export type { ParkingsQueryParams } from './_shared';

export function useParkings(params: ParkingsQueryParams = {}) {
  const token = useToken();
  return useQuery({
    queryKey: parkingKeys.list(params),
    queryFn: () =>
      apiFetch<Parking[]>('/parkings', {
        token,
        query: { ...params },
      }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useCreateParking() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateParkingInput) =>
      apiFetch<Parking>('/parkings', { method: 'POST', body: input, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: parkingKeys.all });
      qc.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useUpdateParking() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateParkingInput & { id: string }) =>
      apiFetch<Parking>(`/parkings/${id}`, { method: 'PATCH', body: input, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: parkingKeys.all });
      qc.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useDeleteParking() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/parkings/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parkingKeys.all }),
  });
}

function useParkingAction(action: 'discuss' | 'reopen') {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Parking>(`/parkings/${id}/${action}`, { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parkingKeys.all }),
  });
}

export const useDiscussParking = () => useParkingAction('discuss');
export const useReopenParking = () => useParkingAction('reopen');
