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
      className="group fixed bottom-5 right-5 z-20 flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-border bg-card/70 backdrop-blur text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors duration-150 shadow-lg shadow-black/40"
    >
      <kbd className="inline-flex items-center justify-center w-5 h-5 rounded border border-border bg-background text-[10px] font-mono text-foreground group-hover:border-primary group-hover:text-primary transition">
        ?
      </kbd>
      <span className="opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto transition-[opacity,width] duration-150 whitespace-nowrap">
        Shortcuts
      </span>
    </button>
  );
}
