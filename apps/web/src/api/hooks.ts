import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthResponse,
  AuthUser,
  Brand,
  BrandActionItem,
  BrandActionStatus,
  BrandFeatureRequest,
  BrandImportInput,
  BrandImportResponse,
  BrandMeeting,
  BrandStakeholder,
  ConnectSheetInput,
  ConnectSheetResponse,
  ConvertFeatureRequestResponse,
  CreateBrandActionItemInput,
  CreateBrandFeatureRequestInput,
  CreateBrandInput,
  CreateBrandMeetingInput,
  CreateBrandStakeholderInput,
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
  SheetSyncPullResponse,
  SheetSyncPushResponse,
  SyncCandidate,
  SyncCandidatesResponse,
  SyncConfirmResponse,
  Task,
  TaskStatus,
  UpdateBrandActionItemInput,
  UpdateBrandFeatureRequestInput,
  UpdateBrandInput,
  UpdateBrandMeetingInput,
  UpdateSyncConfigInput,
  UpdateBrandStakeholderInput,
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

/* ─────────────── brands ─────────────── */

export function useBrands() {
  const token = useToken();
  return useQuery({
    queryKey: ['brands'],
    queryFn: () => apiFetch<Brand[]>('/brands', { token }),
    enabled: !!token,
  });
}

export function useBrand(id: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: ['brands', id],
    queryFn: () => apiFetch<Brand>(`/brands/${id}`, { token }),
    enabled: !!token && !!id,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useUpdateBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBrandInput & { id: string }) =>
      apiFetch<Brand>(`/brands/${id}`, { method: 'PATCH', body: input, token }),
    onSuccess: (data) => {
      qc.setQueryData(['brands', data.id], data);
      qc.invalidateQueries({ queryKey: ['brands'] });
    },
  });
}

export function useDeleteBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/brands/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useImportBrand() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BrandImportInput) =>
      apiFetch<BrandImportResponse>('/brands/import', { method: 'POST', body: input, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

/* ─────────────── brand stakeholders ─────────────── */

export function useBrandStakeholders(brandId: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: ['brands', brandId, 'stakeholders'],
    queryFn: () => apiFetch<BrandStakeholder[]>(`/brands/${brandId}/stakeholders`, { token }),
    enabled: !!token && !!brandId,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'stakeholders'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'stakeholders'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'stakeholders'] }),
  });
}

/* ─────────────── brand meetings ─────────────── */

export function useBrandMeetings(brandId: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: ['brands', brandId, 'meetings'],
    queryFn: () => apiFetch<BrandMeeting[]>(`/brands/${brandId}/meetings`, { token }),
    enabled: !!token && !!brandId,
  });
}

export function useAllBrandMeetings(brandIds: string[]) {
  const token = useToken();
  return useQueries({
    queries: brandIds.map((id) => ({
      queryKey: ['brands', id, 'meetings'],
      queryFn: () => apiFetch<BrandMeeting[]>(`/brands/${id}/meetings`, { token }),
      enabled: !!token,
      staleTime: 60_000,
    })),
  });
}

export function useAllBrandActionItems(brandIds: string[]) {
  const token = useToken();
  return useQueries({
    queries: brandIds.map((id) => ({
      queryKey: ['brands', id, 'action-items', {}],
      queryFn: () => apiFetch<BrandActionItem[]>(`/brands/${id}/action-items`, { token }),
      enabled: !!token,
      staleTime: 60_000,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'meetings'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'meetings'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'meetings'] }),
  });
}

/* ─────────────── brand action items ─────────────── */

export function useBrandActionItems(
  brandId: string | undefined,
  params: { status?: BrandActionStatus } = {},
) {
  const token = useToken();
  return useQuery({
    queryKey: ['brands', brandId, 'action-items', params],
    queryFn: () =>
      apiFetch<BrandActionItem[]>(`/brands/${brandId}/action-items`, {
        token,
        query: { ...params },
      }),
    enabled: !!token && !!brandId,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'action-items'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'action-items'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'action-items'] }),
  });
}

export function useSendActionItemToToday(brandId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ actionItem: BrandActionItem; task: Task }>(
        `/brands/${brandId}/action-items/${id}/send-to-today`,
        { method: 'POST', token },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'action-items'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
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
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'action-items'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/* ─────────────── brand feature requests ─────────────── */

export interface FeatureRequestsQueryParams {
  resolved?: 'true' | 'false';
  search?: string;
}

export function useBrandFeatureRequests(
  brandId: string | undefined,
  params: FeatureRequestsQueryParams = {},
) {
  const token = useToken();
  return useQuery({
    queryKey: ['brands', brandId, 'feature-requests', params],
    queryFn: () =>
      apiFetch<BrandFeatureRequest[]>(`/brands/${brandId}/feature-requests`, {
        token,
        query: { ...params },
      }),
    enabled: !!token && !!brandId,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'feature-requests'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'feature-requests'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands', brandId, 'feature-requests'] }),
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
      qc.invalidateQueries({ queryKey: ['brands', brandId] });
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'feature-requests'] });
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
      qc.invalidateQueries({ queryKey: ['brands', brandId] });
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'feature-requests'] });
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
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'feature-requests'] });
      qc.invalidateQueries({ queryKey: ['brands', brandId] });
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
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'feature-requests'] });
      qc.invalidateQueries({ queryKey: ['brands', brandId] });
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
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'feature-requests'] });
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'action-items'] });
    },
  });
}

/* ─────────────── brand sync ─────────────── */

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
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'meetings'] });
      qc.invalidateQueries({ queryKey: ['brands', brandId, 'action-items'] });
      qc.invalidateQueries({ queryKey: ['brands', brandId] });
      qc.invalidateQueries({ queryKey: ['brands'] });
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
      qc.invalidateQueries({ queryKey: ['brands', brandId] });
    },
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
