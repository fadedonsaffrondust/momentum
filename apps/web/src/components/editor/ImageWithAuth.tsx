import { useCallback, useRef, useState } from 'react';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Download, FileImage } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { cn } from '../../lib/utils';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const MIN_IMAGE_WIDTH = 80;

export function ImageView({ node, selected, editor, updateAttributes }: NodeViewProps) {
  const token = useAuthStore((s) => s.token);
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? '';
  const storedWidth = (node.attrs.width as number | null) ?? null;
  const [loadFailed, setLoadFailed] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // The HTML stores the bare API path (`/attachments/<id>/download`) so the
  // serialized description is portable across environments. At render time
  // we prepend the API base — otherwise the browser resolves the relative
  // src against the Vite dev server (localhost:5173) which 404s.
  // TODO(storage): when signed URLs land, drop the query-string token —
  // the upload route will return a URL that already authenticates itself.
  let finalSrc = src;
  if (src.startsWith('/attachments/')) {
    finalSrc = `${API_BASE}${src}`;
    if (token) finalSrc += `?token=${encodeURIComponent(token)}`;
  }

  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Keep the press off ProseMirror / the node-drag handler — the handle
      // is chrome on top of the image, not a drag grip for the node.
      e.preventDefault();
      e.stopPropagation();
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const startX = e.clientX;
      const startWidth = wrapper.getBoundingClientRect().width;
      // Parent (ProseMirror block) width is the natural upper bound — matches
      // the existing `max-width: 100%` CSS so dragging past the edge clamps
      // instead of overflowing.
      const maxWidth = wrapper.parentElement?.clientWidth ?? startWidth;

      const clamp = (w: number) => Math.round(Math.min(Math.max(MIN_IMAGE_WIDTH, w), maxWidth));

      const onMove = (ev: PointerEvent) => {
        setPreviewWidth(clamp(startWidth + (ev.clientX - startX)));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const next = clamp(startWidth + (ev.clientX - startX));
        setPreviewWidth(null);
        updateAttributes({ width: next });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [updateAttributes],
  );

  // Some image formats — HEIC, HEIF, sometimes AVIF — aren't natively
  // rendered by Chrome / Firefox. The bytes arrive fine, the browser just
  // can't decode them. Rather than the default "broken-image icon next to
  // the alt text" treatment, render a downloadable card so the user can
  // open the file locally with an app that understands it.
  if (loadFailed) {
    return (
      <NodeViewWrapper as="div" className="task-attachment-image-wrap my-2">
        <div className="rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm flex items-center gap-3">
          <FileImage className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-foreground">{alt || 'Image'}</div>
            <div className="text-2xs text-muted-foreground">Preview unavailable in the browser</div>
          </div>
          <a
            href={finalSrc}
            download={alt || undefined}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors duration-150"
            title="Download"
            contentEditable={false}
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </NodeViewWrapper>
    );
  }

  const displayedWidth = previewWidth ?? storedWidth;
  const showHandle = selected && editor.isEditable;

  return (
    <NodeViewWrapper
      as="div"
      ref={wrapperRef}
      className={cn('task-attachment-image-wrap my-2')}
      data-selected={showHandle ? 'true' : undefined}
    >
      <img
        src={finalSrc}
        alt={alt}
        className="task-attachment-image"
        style={displayedWidth ? { width: `${displayedWidth}px` } : undefined}
        onError={() => setLoadFailed(true)}
        draggable={false}
      />
      {showHandle ? (
        <button
          type="button"
          aria-label="Resize image"
          className="task-attachment-image-resize-handle"
          onPointerDown={handleResizeStart}
          onMouseDown={(e) => e.preventDefault()}
          contentEditable={false}
        />
      ) : null}
    </NodeViewWrapper>
  );
}

/**
 * Wraps Tiptap's built-in Image extension with a NodeView that injects
 * `?token=<jwt>` for `<img>` tags pointing at our /attachments/:id/download
 * route — `<img>` requests can't carry an Authorization header, and the
 * server's download route accepts ?token= as a v1 expedient.
 *
 * The HTML we persist remains the bare `<img src="/attachments/…">` — the
 * token is appended client-side, never stored. The `width` attribute is
 * inherited from the upstream Image extension and serializes to
 * `<img width="N">` when the user resizes via the corner handle.
 */
export const ImageWithAuth = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
