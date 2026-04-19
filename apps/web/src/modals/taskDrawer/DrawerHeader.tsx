import { X } from 'lucide-react';

export function DrawerHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="px-5 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Task detail</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-muted-foreground hover:text-foreground transition-colors duration-150"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}
