import { useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';

interface Props {
  open: boolean;
  /** Restricts the OS file picker to images when true. */
  imageOnly: boolean;
  /** Position to anchor the popover (in viewport coords). */
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  onPick: (file: File) => void;
}

/**
 * "Choose a file" popover that opens when the user fires `/image` or
 * `/attachment` from the description editor's slash menu. v1 has a single
 * "Upload" tab that triggers a hidden `<input type="file">`; the "Link"
 * tab from the reference design is deferred until cloud storage and URL
 * embedding ship together.
 */
export function UploadPopover({ open, imageOnly, anchor, onClose, onPick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-trigger the OS picker on open so the popover is more of a
  // confirmation surface than a click target — matches the user's
  // muscle memory from Notion / Linear where `/image` opens the picker
  // immediately.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.click(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open || !anchor) return null;

  return (
    <div
      role="dialog"
      aria-label="Upload file"
      className="fixed z-50 w-72 rounded-md border border-border bg-popover text-popover-foreground shadow-md p-2"
      style={{ left: anchor.x, top: anchor.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 border-b border-border/60 pb-2">
        <button
          type="button"
          className="px-2 py-1 rounded text-xs font-medium bg-secondary text-secondary-foreground"
        >
          Upload
        </button>
        <span
          className="px-2 py-1 rounded text-xs text-muted-foreground/60 cursor-not-allowed"
          title="Link embedding ships with cloud storage"
        >
          Link
        </span>
      </div>
      <div className="pt-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity duration-150"
        >
          <Upload className="h-4 w-4" />
          Choose a file
        </button>
        <p className="mt-2 text-2xs text-muted-foreground text-center">
          Max 10 MB · {imageOnly ? 'images only' : 'any file'}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={imageOnly ? 'image/*' : undefined}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onPick(file);
          }
          // Reset so picking the same file twice still triggers onChange.
          e.target.value = '';
          onClose();
        }}
      />
    </div>
  );
}
