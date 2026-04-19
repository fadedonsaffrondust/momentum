import type { AutosaveStatus } from '../../hooks/useAutosaveForm';

interface Props {
  /** Status of the local debounce timer. */
  autosaveStatus: AutosaveStatus;
  /** True while the underlying mutation is in flight (post-debounce). */
  mutationPending: boolean;
  onClose: () => void;
}

/**
 * "Saving…" while either the debounce timer is queued OR the mutation
 * is still in flight; "Saved" only when both are settled. Bridges the
 * autosave hook's local status with the API call's network status.
 */
export function DrawerFooter({ autosaveStatus, mutationPending, onClose }: Props) {
  const saving = autosaveStatus === 'pending' || mutationPending;
  return (
    <footer className="px-5 py-3 border-t border-border/60 flex items-center justify-between shrink-0">
      <div className="text-[10px] text-muted-foreground/70">
        {saving ? 'Saving…' : 'Saved'} · Esc to close · j / k still navigate
      </div>
      <button
        type="button"
        onClick={onClose}
        className="px-3 py-1.5 rounded-md border border-border hover:bg-secondary text-sm transition-colors duration-150"
      >
        Close
      </button>
    </footer>
  );
}
