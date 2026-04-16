import { useEffect, useRef } from 'react';
import { exportFileSchema } from '@momentum/shared';
import { useExportData } from '../api/hooks';
import { useUiStore } from '../store/ui';

function downloadBlob(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataSync() {
  const exportData = useExportData();
  const pushToast = useUiStore((s) => s.pushToast);
  const openModal = useUiStore((s) => s.openModal);
  const setPendingImport = useUiStore((s) => s.setPendingImport);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onExport = async () => {
      try {
        const data = await exportData.mutateAsync();
        const today = new Date().toISOString().slice(0, 10);
        downloadBlob(`momentum-backup-${today}.json`, JSON.stringify(data, null, 2));
        pushToast({
          kind: 'success',
          message: `Exported ${data.tasks.length} tasks and ${data.dailyLogs.length} daily logs`,
          durationMs: 4000,
        });
      } catch (err) {
        pushToast({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Export failed',
          durationMs: 4000,
        });
      }
    };

    const onImport = () => {
      fileInputRef.current?.click();
    };

    window.addEventListener('momentum:export', onExport);
    window.addEventListener('momentum:import', onImport);
    return () => {
      window.removeEventListener('momentum:export', onExport);
      window.removeEventListener('momentum:import', onImport);
    };
  }, [exportData, pushToast]);

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const parsed = exportFileSchema.safeParse(json);
      if (!parsed.success) {
        pushToast({
          kind: 'error',
          message: 'Invalid file. Expected a Momentum export file.',
          durationMs: 5000,
        });
        return;
      }
      setPendingImport(parsed.data);
      openModal('import-confirm');
    } catch {
      pushToast({
        kind: 'error',
        message: 'Could not read file.',
        durationMs: 4000,
      });
    }
  };

  return (
    <input
      ref={fileInputRef}
      type="file"
      accept="application/json,.json"
      className="hidden"
      onChange={onFileChosen}
    />
  );
}
