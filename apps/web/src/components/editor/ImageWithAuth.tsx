import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useAuthStore } from '../../store/auth';

function ImageView({ node }: NodeViewProps) {
  const token = useAuthStore((s) => s.token);
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? '';

  // TODO(storage): when signed URLs land, drop the query-string token —
  // the upload route returns a URL that already authenticates itself.
  const isAttachmentUrl = src.startsWith('/attachments/');
  const finalSrc = isAttachmentUrl && token ? `${src}?token=${encodeURIComponent(token)}` : src;

  return (
    <NodeViewWrapper as="div" className="task-attachment-image-wrap my-2">
      <img src={finalSrc} alt={alt} className="task-attachment-image" />
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
 * token is appended client-side, never stored.
 */
export const ImageWithAuth = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
