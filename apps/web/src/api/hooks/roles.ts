import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRoleInput, Role } from '@momentum/shared';
import { apiFetch, roleKeys, useToken } from './_shared';

export function useRoles() {
  const token = useToken();
  return useQuery({
    queryKey: roleKeys.all,
    queryFn: () => apiFetch<Role[]>('/roles', { token }),
    enabled: !!token,
  });
}

export function useCreateRole() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) =>
      apiFetch<Role>('/roles', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useDeleteRole() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/roles/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}
