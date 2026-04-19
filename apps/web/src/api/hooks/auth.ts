import { useMutation, useQuery } from '@tanstack/react-query';
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '@momentum/shared';
import { useAuthStore } from '../../store/auth';
import { apiFetch, meKeys, useToken } from './_shared';

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input }),
    onSuccess: (res) => setAuth(res.token, res.user),
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: input }),
    onSuccess: (res) => setAuth(res.token, res.user),
  });
}

export function useMe() {
  const token = useToken();
  return useQuery({
    queryKey: meKeys.detail(token),
    queryFn: () => apiFetch<AuthUser>('/auth/me', { token }),
    enabled: !!token,
    retry: false,
  });
}
