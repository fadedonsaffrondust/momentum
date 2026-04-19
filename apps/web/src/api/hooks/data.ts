import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExportFile, ImportRequest } from '@momentum/shared';
import { apiFetch, useToken } from './_shared';

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
      // Wholesale invalidation — import touches every collection.
      qc.invalidateQueries();
    },
  });
}
