import type { ReactNode } from 'react';

/** Single labeled row in the task drawer's compact property panel. */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium w-20 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}
