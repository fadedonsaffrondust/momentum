import { Modal } from '../components/Modal';
import { useUiStore } from '../store/ui';
import { useImportData } from '../api/hooks';

export function ImportConfirmModal() {
  const close = useUiStore((s) => s.closeModal);
  const pending = useUiStore((s) => s.pendingImport);
  const setPendingImport = useUiStore((s) => s.setPendingImport);
  const pushToast = useUiStore((s) => s.pushToast);
  const importData = useImportData();

  if (!pending) {
    return (
      <Modal title="Import data" onClose={close}>
        <p className="text-sm text-m-fg-muted">No file selected.</p>
      </Modal>
    );
  }

  const apply = async (mode: 'replace' | 'merge') => {
    try {
      const res = await importData.mutateAsync({ mode, file: pending });
      pushToast({
        kind: 'success',
        message: `Imported ${res.imported.tasks} tasks, ${res.imported.roles} roles, ${res.imported.dailyLogs} daily logs`,
        durationMs: 4000,
      });
      setPendingImport(null);
      close();
    } catch (err) {
      pushToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Import failed',
        durationMs: 4000,
      });
    }
  };

  return (
    <Modal title="Import data" onClose={close}>
      <div className="space-y-4 text-sm text-m-fg-secondary">
        <p>
          This file contains <span className="text-accent">{pending.tasks.length}</span> tasks,{' '}
          <span className="text-accent">{pending.roles.length}</span> roles, and{' '}
          <span className="text-accent">{pending.dailyLogs.length}</span> daily logs.
        </p>
        <p className="text-xs text-m-fg-muted">
          Choose <strong>Replace</strong> to wipe your current data and load this file, or{' '}
          <strong>Merge</strong> to keep existing data and add new entries.
        </p>

        <div className="flex gap-2 pt-2">
          <button
            onClick={close}
            className="flex-1 py-2 rounded-md border border-m-border text-sm hover:bg-m-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={() => apply('merge')}
            disabled={importData.isPending}
            className="flex-1 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            Merge
          </button>
          <button
            onClick={() => apply('replace')}
            disabled={importData.isPending}
            className="flex-1 py-2 rounded-md bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50"
          >
            Replace
          </button>
        </div>
      </div>
    </Modal>
  );
}
