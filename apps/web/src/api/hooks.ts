import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthResponse,
  AuthUser,
  CreateParkingInput,
  CreateRoleInput,
  CreateTaskInput,
  DailyLog,
  ExportFile,
  LoginInput,
  Parking,
  ParkingStatus,
  RegisterInput,
  Role,
  Task,
  TaskStatus,
  UpdateParkingInput,
  UpdateSettingsInput,
  UpdateTaskInput,
  UpsertDailyLogInput,
  UserSettings,
  WeeklyStats,
  ImportRequest,
} from '@momentum/shared';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/auth';

const useToken = () => useAuthStore((s) => s.token);

/* ─────────────── auth ─────────────── */

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
    queryKey: ['me', token],
    queryFn: () => apiFetch<AuthUser>('/auth/me', { token }),
    enabled: !!token,
    retry: false,
  });
}

/* ─────────────── settings ─────────────── */

export function useSettings() {
  const token = useToken();
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<UserSettings>('/settings', { token }),
    enabled: !!token,
  });
}

export function useUpdateSettings() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) =>
      apiFetch<UserSettings>('/settings', { method: 'PUT', body: input, token }),
    onSuccess: (data) => qc.setQueryData(['settings'], data),
  });
}

/* ─────────────── roles ─────────────── */

export function useRoles() {
  const token = useToken();
  return useQuery({
    queryKey: ['roles'],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useDeleteRole() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/roles/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

/* ─────────────── tasks ─────────────── */

export interface TasksQueryParams {
  date?: string;
  roleId?: string;
  status?: TaskStatus;
}

export function useTasks(params: TasksQueryParams = {}) {
  const token = useToken();
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () =>
      apiFetch<Task[]>('/tasks', {
        token,
        query: { ...params },
      }),
    enabled: !!token,
  });
}

export function useCreateTask() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch<Task>('/tasks', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTaskInput & { id: string }) =>
      apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/tasks/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

function useTaskAction(action: 'start' | 'pause' | 'complete' | 'defer') {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Task>(`/tasks/${id}/${action}`, { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export const useStartTask = () => useTaskAction('start');
export const usePauseTask = () => useTaskAction('pause');
export const useCompleteTask = () => useTaskAction('complete');
export const useDeferTask = () => useTaskAction('defer');

/* ─────────────── parkings ─────────────── */

export interface ParkingsQueryParams {
  status?: ParkingStatus;
  targetDate?: string;
  roleId?: string;
}

export function useParkings(params: ParkingsQueryParams = {}) {
  const token = useToken();
  return useQuery({
    queryKey: ['parkings', params],
    queryFn: () =>
      apiFetch<Parking[]>('/parkings', {
        token,
        query: { ...params },
      }),
    enabled: !!token,
  });
}

export function useCreateParking() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateParkingInput) =>
      apiFetch<Parking>('/parkings', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parkings'] }),
  });
}

export function useUpdateParking() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateParkingInput & { id: string }) =>
      apiFetch<Parking>(`/parkings/${id}`, { method: 'PATCH', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parkings'] }),
  });
}

export function useDeleteParking() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/parkings/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parkings'] }),
  });
}

function useParkingAction(action: 'discuss' | 'reopen') {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Parking>(`/parkings/${id}/${action}`, { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parkings'] }),
  });
}

export const useDiscussParking = () => useParkingAction('discuss');
export const useReopenParking = () => useParkingAction('reopen');

/* ─────────────── daily logs + stats ─────────────── */

export function useDailyLogs(limit = 30) {
  const token = useToken();
  return useQuery({
    queryKey: ['daily-logs', limit],
    queryFn: () => apiFetch<DailyLog[]>('/daily-logs', { token, query: { limit } }),
    enabled: !!token,
  });
}

export function useUpsertDailyLog() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertDailyLogInput) =>
      apiFetch<DailyLog>('/daily-logs', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-logs'] }),
  });
}

export function useWeeklyStats() {
  const token = useToken();
  return useQuery({
    queryKey: ['weekly-stats'],
    queryFn: () => apiFetch<WeeklyStats>('/stats/weekly', { token }),
    enabled: !!token,
  });
}

/* ─────────────── export / import ─────────────── */

export function useExportData() {
  const token = useToken();
  return useMutation({
    mutationFn: () => apiFetch<ExportFile>('/export', { token }),
  });
}

export function useImportData() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportRequest) =>
      apiFetch<{ ok: true; imported: { tasks: number; roles: number; dailyLogs: number } }>(
        '/import',
        { method: 'POST', body: input, token },
      ),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
