import { Node, mergeAttributes, type CommandProps } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Download, FileText, Loader2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachment: {
      insertAttachment: (attrs: AttachmentAttrs) => ReturnType;
    };
  }
}

export interface AttachmentAttrs {
  id: string | null;
  name: string;
  mimeType: string;
  size: number;
  /** When true, the node is a placeholder shown while the upload runs.
   *  Inserted with isLoading=true, then `updateAttributes({ id, isLoading:false })`
   *  swaps in the persisted attachment id once the mutation resolves. */
  isLoading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentView({ node, deleteNode, editor }: NodeViewProps) {
  const attrs = node.attrs as AttachmentAttrs;
  const token = useAuthStore((s) => s.token);
  // TODO(storage): remove ?token= once cloud storage + signed URLs land.
  const downloadUrl = attrs.id
    ? `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/attachments/${attrs.id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : null;

  const editable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="div"
      className="task-attachment-node my-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm flex items-center gap-3"
      data-attachment-id={attrs.id ?? undefined}
    >
      <div className="shrink-0 text-muted-foreground">
        {attrs.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-foreground">{attrs.name}</div>
        <div className="text-2xs text-muted-foreground">
          {attrs.isLoading ? 'Uploading…' : `${formatBytes(attrs.size)} · ${attrs.mimeType}`}
        </div>
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={attrs.name}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors duration-150"
          title="Download"
          contentEditable={false}
        >
          <Download className="h-4 w-4" />
        </a>
      )}
      {editable && (
        <button
          type="button"
          onClick={() => deleteNode()}
          className="shrink-0 p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors duration-150"
          title="Remove"
          contentEditable={false}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </NodeViewWrapper>
  );
}

/**
 * Custom block-level Tiptap node representing a non-image file attachment
 * embedded in a task description. Stores the persisted attachment id, the
 * original filename, mime type, and size in HTML data-attributes so the
 * node round-trips through plain HTML (the only thing we serialize).
 *
 * Images use Tiptap's built-in Image extension instead — they need real
 * `<img>` tags so the browser handles loading; this node is purely for
 * non-image files that render as a download row.
 */
export const AttachmentNode = Node.create({
  name: 'attachment',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: null as string | null },
      name: { default: '' },
      mimeType: { default: 'application/octet-stream' },
      size: { default: 0 },
      isLoading: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-attachment-id]',
        getAttrs: (el: HTMLElement | string) => {
          if (typeof el === 'string') return false;
          const id = el.getAttribute('data-attachment-id');
          if (!id) return false;
          return {
            id,
            name: el.getAttribute('data-attachment-name') ?? '',
            mimeType: el.getAttribute('data-attachment-mime') ?? 'application/octet-stream',
            size: Number(el.getAttribute('data-attachment-size') ?? 0),
            isLoading: false,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }: { HTMLAttributes: Record<string, unknown>; node: any }) {
    const attrs = node.attrs as AttachmentAttrs;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-attachment-id': attrs.id,
        'data-attachment-name': attrs.name,
        'data-attachment-mime': attrs.mimeType,
        'data-attachment-size': String(attrs.size),
        class: 'task-attachment',
      }),
      attrs.name,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView);
  },

  addCommands() {
    return {
      insertAttachment:
        (attrs: AttachmentAttrs) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
