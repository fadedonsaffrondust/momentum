import { createContext, useContext, useRef } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import type { UploadedAttachment } from '../RichDescriptionEditor.types';

/**
 * Shared context that lets the placeholder NodeView reach the editor's
 * upload handler. The NodeView is rendered by Tiptap's React renderer
 * inside `EditorContent`'s portal tree, so a standard React Context
 * provider above `<EditorContent>` reaches it without prop-drilling
 * through extension options.
 */
export interface EditorUploadContextValue {
  /**
   * Upload the file and return the persisted attachment metadata. The
   * caller (placeholder NodeView) replaces its own document position
   * with the resulting image/attachment node.
   */
  upload: ((file: File) => Promise<UploadedAttachment>) | null;
  /** Reports validation / network errors back to the parent (toast). */
  onError: (message: string) => void;
}

export const EditorUploadContext = createContext<EditorUploadContextValue>({
  upload: null,
  onError: () => undefined,
});

export type AttachmentPlaceholderKind = 'image' | 'file';

interface PlaceholderAttrs {
  kind: AttachmentPlaceholderKind;
}

const MAX_BYTES = 10 * 1024 * 1024;

const COPY: Record<AttachmentPlaceholderKind, { label: string; accept: string | undefined }> = {
  image: { label: 'Add an image', accept: 'image/*' },
  file: { label: 'Upload or embed a file', accept: undefined },
};

function PlaceholderView({ node, editor, getPos, deleteNode }: NodeViewProps) {
  const attrs = node.attrs as PlaceholderAttrs;
  const { upload, onError } = useContext(EditorUploadContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const { label, accept } = COPY[attrs.kind];
  const Icon = attrs.kind === 'image' ? ImageIcon : Upload;

  const editable = editor.isEditable;

  const handleFile = async (file: File) => {
    if (!upload) {
      onError('Uploads are not enabled here.');
      return;
    }
    if (file.size > MAX_BYTES) {
      onError(`"${file.name}" is too large (max 10 MB).`);
      return;
    }
    const pos = getPos();
    if (typeof pos !== 'number') return;

    try {
      const att = await upload(file);
      const isImage = att.mimeType.startsWith('image/');
      // Replace the placeholder span with the persisted node at the same
      // position. Using insertContentAt with an explicit { from, to } range
      // is the Tiptap-blessed way to swap a node out without cursor jumps.
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from: pos, to: pos + node.nodeSize },
          isImage
            ? { type: 'image', attrs: { src: att.url, alt: att.name } }
            : {
                type: 'attachment',
                attrs: {
                  id: att.id,
                  name: att.name,
                  mimeType: att.mimeType,
                  size: att.size,
                  isLoading: false,
                },
              },
        )
        .run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      onError(msg);
    }
  };

  return (
    <NodeViewWrapper
      as="div"
      className="task-attachment-placeholder my-2"
      data-attachment-placeholder
      data-kind={attrs.kind}
    >
      <div className="group relative">
        <button
          type="button"
          disabled={!editable}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center gap-3 rounded-md border border-border/60 bg-secondary/40 hover:bg-secondary/60 px-3 py-3 text-sm text-muted-foreground transition-colors duration-150 disabled:opacity-60 disabled:cursor-default"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{label}</span>
        </button>
        {editable && (
          <button
            type="button"
            onClick={() => deleteNode()}
            contentEditable={false}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:text-destructive hover:bg-secondary/80 transition-colors duration-150"
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Reset before handling so picking the same file twice still
          // fires onChange (browsers deduplicate by value otherwise).
          e.target.value = '';
          if (f) void handleFile(f);
        }}
      />
    </NodeViewWrapper>
  );
}

/**
 * Notion-style persistent placeholder block. Inserted by the `/image` and
 * `/attachment` slash commands. The card stays in the document until the
 * user clicks it to upload (which swaps it for the real image / attachment
 * node) or deletes it with Backspace / the hover ✕ button.
 *
 * Persisted in HTML as `<div data-attachment-placeholder data-kind=...>`
 * so closing/reopening the drawer keeps the placeholder in place.
 */
export const AttachmentPlaceholderNode = Node.create({
  name: 'attachmentPlaceholder',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      kind: { default: 'file' as AttachmentPlaceholderKind },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-attachment-placeholder]',
        getAttrs: (el: HTMLElement | string) => {
          if (typeof el === 'string') return false;
          const kind = el.getAttribute('data-kind');
          return { kind: kind === 'image' ? 'image' : 'file' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }: { HTMLAttributes: Record<string, unknown>; node: any }) {
    const attrs = node.attrs as PlaceholderAttrs;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-attachment-placeholder': '',
        'data-kind': attrs.kind,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlaceholderView);
  },
});
