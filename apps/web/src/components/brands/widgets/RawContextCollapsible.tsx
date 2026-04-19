import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Collapsed-by-default raw-import dump. Shown only on brands that were
 * AI-imported (the rawImportContent is what the LLM was given) — used as
 * an escape hatch when the user wants to verify what the extractor saw.
 */
export function RawContextCollapsible({
  content,
  source,
}: {
  content: string;
  source: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Imported context
        {source && <span className="text-muted-foreground/70">({source})</span>}
      </button>
      {open && (
        <pre className="mt-2 p-3 bg-card/60 border border-border/60 rounded-lg text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto leading-relaxed animate-slideUp">
          {content}
        </pre>
      )}
    </div>
  );
}
