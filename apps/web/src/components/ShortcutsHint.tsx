import { useUiStore } from '../store/ui';

export function ShortcutsHint() {
  const openModal = useUiStore((s) => s.openModal);
  const activeModal = useUiStore((s) => s.activeModal);
  if (activeModal) return null;

  return (
    <button
      onClick={() => openModal('shortcuts')}
      aria-label="Keyboard shortcuts"
      title="Keyboard shortcuts (?)"
      className="group fixed bottom-5 right-5 z-20 flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-m-border bg-m-surface/70 backdrop-blur text-xs text-m-fg-muted hover:text-m-fg hover:border-m-border-strong transition-all duration-200 shadow-lg shadow-black/40"
    >
      <kbd className="inline-flex items-center justify-center w-5 h-5 rounded border border-m-border-strong bg-m-bg text-[10px] font-mono text-m-fg-secondary group-hover:border-accent group-hover:text-accent transition">
        ?
      </kbd>
      <span className="opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto transition-all duration-200 whitespace-nowrap">
        Shortcuts
      </span>
    </button>
  );
}
