import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTaskInput, Task, TeamTaskList, UpdateTaskInput } from '@momentum/shared';
import {
  apiFetch,
  inboxKeys,
  SHARED_STALE_TIME,
  taskKeys,
  type TasksQueryParams,
  type TeamTasksQueryParams,
  useToken,
} from './_shared';

export type { TasksQueryParams } from './_shared';

export function useTasks(params: TasksQueryParams = {}) {
  const token = useToken();
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () =>
      apiFetch<Task[]>('/tasks', {
        token,
        query: { ...params },
      }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
  });
}

/** Team Task View: sections grouped by assignee, current user first. */
export function useTeamTasks(params: TeamTasksQueryParams = {}) {
  const token = useToken();
  return useQuery({
    queryKey: taskKeys.team(params),
    queryFn: () =>
      apiFetch<TeamTaskList>('/tasks/team', {
        token,
        query: { ...params },
      }),
    enabled: !!token,
    staleTime: SHARED_STALE_TIME,
  });
}

export function useCreateTask() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch<Task>('/tasks', { method: 'POST', body: input, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useUpdateTask() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTaskInput & { id: string }) =>
      apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: input, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useDeleteTask() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/tasks/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

function useTaskAction(action: 'start' | 'pause' | 'complete' | 'defer' | 'reopen') {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Task>(`/tasks/${id}/${action}`, { method: 'POST', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export const useStartTask = () => useTaskAction('start');
export const usePauseTask = () => useTaskAction('pause');
export const useCompleteTask = () => useTaskAction('complete');
export const useDeferTask = () => useTaskAction('defer');
export const useReopenTask = () => useTaskAction('reopen');
