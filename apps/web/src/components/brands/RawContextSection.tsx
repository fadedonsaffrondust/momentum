import { useState } from 'react';
import type { Brand } from '@momentum/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  brand: Brand;
}

export function RawContextSection({ brand }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const hasImport = !!brand.rawImportContent;

  return (
    <section className="px-6 py-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {collapsed ? (
          <ChevronRight size={14} className="text-m-fg-dim" />
        ) : (
          <ChevronDown size={14} className="text-m-fg-dim" />
        )}
        <h2 className="text-[10px] uppercase tracking-widest text-m-fg-muted font-semibold group-hover:text-m-fg-secondary transition">
          Raw Context
        </h2>
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-4 animate-slideUp">
          {hasImport && (
            <div>
              <span className="text-[10px] uppercase tracking-widest text-m-fg-dim">
                Imported content
                {brand.importedFrom && (
                  <span className="ml-1 normal-case">({brand.importedFrom})</span>
                )}
              </span>
              <pre className="mt-1 p-3 bg-m-surface-60 border border-m-border rounded-lg text-xs text-m-fg-tertiary whitespace-pre-wrap font-mono max-h-64 overflow-y-auto leading-relaxed">
                {brand.rawImportContent}
              </pre>
            </div>
          )}

          {!hasImport && (
            <p className="text-xs text-m-fg-dim">
              No imported content. This brand was created manually.
            </p>
          )}

          <div className="border border-dashed border-m-border rounded-lg p-4 text-center">
            <p className="text-xs text-m-fg-dim">
              Custom fields — coming soon.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
