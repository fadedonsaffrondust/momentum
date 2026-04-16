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
          <ChevronRight size={14} className="text-zinc-600" />
        ) : (
          <ChevronDown size={14} className="text-zinc-600" />
        )}
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold group-hover:text-zinc-300 transition">
          Raw Context
        </h2>
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-4 animate-slideUp">
          {hasImport && (
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                Imported content
                {brand.importedFrom && (
                  <span className="ml-1 normal-case">({brand.importedFrom})</span>
                )}
              </span>
              <pre className="mt-1 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-400 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto leading-relaxed">
                {brand.rawImportContent}
              </pre>
            </div>
          )}

          {!hasImport && (
            <p className="text-xs text-zinc-600">
              No imported content. This brand was created manually.
            </p>
          )}

          <div className="border border-dashed border-zinc-800 rounded-lg p-4 text-center">
            <p className="text-xs text-zinc-600">
              Custom fields — coming soon.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
