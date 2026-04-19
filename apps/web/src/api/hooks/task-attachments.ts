import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskAttachment } from '@momentum/shared';
import { apiFetch, taskKeys, useToken } from './_shared';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function useUploadTaskAttachment(taskId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new Error('File too large (max 10 MB)');
      }
      const fd = new FormData();
      fd.append('file', file, file.name);
      return apiFetch<TaskAttachment>(`/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: fd,
        token,
      });
    },
    // Tasks list / drawer doesn't need to refetch on upload — the new
    // attachment id is inserted into the description HTML which the
    // autosave path persists. We invalidate tasks so the next fetch sees
    // the latest description if the user navigated away mid-upload.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useDeleteTaskAttachment() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch<{ ok: true }>(`/attachments/${attachmentId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
