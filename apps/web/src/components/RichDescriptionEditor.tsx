import { useCallback, useEffect, useRef, useState } from 'react';
import { Extension, ReactRenderer } from '@tiptap/react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { cn } from '@/lib/utils';
import { AttachmentNode, type AttachmentAttrs } from './editor/AttachmentNode';
import { ImageWithAuth } from './editor/ImageWithAuth';
import { UploadPopover } from '../modals/taskDrawer/UploadPopover';

/**
 * Notion-style rich-text editor for task descriptions. Supports a minimal
 * set of block types (paragraph, heading 1–2, checklist, image, attachment)
 * and an inline slash-command menu: type `/` to open a picker, navigate
 * with arrow keys, Enter to apply, Esc to close.
 *
 * Image and attachment support is wired three ways:
 *   - `/image` and `/attachment` slash commands open an upload popover.
 *   - Drag-and-drop a file onto the editor uploads it.
 *   - Paste a file (e.g. Cmd+V on a screenshot) uploads it.
 *
 * Storage is HTML — keeps existing plain-text descriptions working
 * (they load as a single paragraph) and round-trips cleanly. Image src
 * attributes point at `/attachments/<id>/download`; the ImageWithAuth
 * extension's NodeView appends `?token=<jwt>` at render time.
 */

interface SlashItem {
  id: 'h1' | 'h2' | 'todo' | 'image' | 'attachment';
  title: string;
  description: string;
  keywords: string[];
  command: (ctx: { editor: Editor; range: { from: number; to: number } }) => void;
}

/** Result the consumer's upload callback must return. */
export interface UploadedAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** API URL the editor inserts as image src, e.g. `/attachments/<id>/download`. */
  url: string;
}

export type UploadFileFn = (file: File) => Promise<UploadedAttachment>;

/** React component that renders the slash menu list inside tippy. */
function SlashMenuList({
  items,
  command,
  activeIndex,
}: {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  activeIndex: number;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-sm p-2 text-xs text-muted-foreground">
        No matches.
      </div>
    );
  }
  return (
    <div
      role="listbox"
      className="min-w-[220px] rounded-md border border-border bg-popover text-popover-foreground shadow-sm p-1 text-sm"
    >
      {items.map((item, idx) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={idx === activeIndex}
          onMouseDown={(e) => {
            // Prevent the editor from losing focus before we run the command.
            e.preventDefault();
            command(item);
          }}
          className={cn(
            'w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-sm text-left transition-colors duration-100',
            idx === activeIndex
              ? 'bg-secondary text-secondary-foreground'
              : 'text-foreground hover:bg-secondary/60',
          )}
        >
          <div className="min-w-0">
            <div className="truncate">{item.title}</div>
            <div className="text-2xs text-muted-foreground truncate">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

interface MenuRendererState {
  items: SlashItem[];
  activeIndex: number;
  command: (item: SlashItem) => void;
}

/**
 * Build the Slash extension. Items are passed in so the parent component
 * can route /image and /attachment commands back up (they need React state
 * for the popover, which can't live inside the ProseMirror plugin).
 */
function createSlashExtension(items: SlashItem[], onOpenChange: (open: boolean) => void) {
  return Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem>({
          editor: this.editor,
          char: '/',
          startOfLine: false,
          allowSpaces: false,
          items: ({ query }) => {
            const q = query.toLowerCase();
            if (!q) return items;
            return items.filter(
              (item) =>
                item.keywords.some((k) => k.startsWith(q)) || item.title.toLowerCase().includes(q),
            );
          },
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          render: () => {
            let renderer: ReactRenderer<unknown, MenuRendererState> | null = null;
            let popup: TippyInstance | null = null;
            let activeIndex = 0;
            let currentProps: SuggestionProps<SlashItem> | null = null;

            const runCommand = (item: SlashItem) => {
              if (!currentProps) return;
              currentProps.command(item);
            };

            const update = () => {
              if (!renderer || !currentProps) return;
              renderer.updateProps({
                items: currentProps.items,
                activeIndex,
                command: runCommand,
              });
            };

            return {
              onStart: (props) => {
                currentProps = props;
                activeIndex = 0;
                onOpenChange(true);

                renderer = new ReactRenderer(SlashMenuList, {
                  props: {
                    items: props.items,
                    activeIndex,
                    command: runCommand,
                  },
                  editor: props.editor,
                });

                const rect = props.clientRect?.();
                if (!rect) return;

                popup = tippy(document.body, {
                  getReferenceClientRect: () => props.clientRect?.() ?? rect,
                  appendTo: () => document.body,
                  content: renderer.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  offset: [0, 4],
                  arrow: false,
                  theme: 'momentum-slash',
                  maxWidth: 'none',
                });
              },
              onUpdate: (props) => {
                currentProps = props;
                if (activeIndex >= props.items.length) {
                  activeIndex = Math.max(0, props.items.length - 1);
                }
                update();
                const rect = props.clientRect?.();
                if (popup && rect) {
                  popup.setProps({
                    getReferenceClientRect: () => props.clientRect?.() ?? rect,
                  });
                }
              },
              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (!currentProps) return false;
                if (props.event.key === 'ArrowUp') {
                  activeIndex =
                    (activeIndex + currentProps.items.length - 1) %
                    Math.max(1, currentProps.items.length);
                  update();
                  return true;
                }
                if (props.event.key === 'ArrowDown') {
                  activeIndex = (activeIndex + 1) % Math.max(1, currentProps.items.length);
                  update();
                  return true;
                }
                if (props.event.key === 'Enter') {
                  const selected = currentProps.items[activeIndex];
                  if (selected) runCommand(selected);
                  return true;
                }
                if (props.event.key === 'Escape') {
                  popup?.hide();
                  return true;
                }
                return false;
              },
              onExit: () => {
                popup?.destroy();
                popup = null;
                renderer?.destroy();
                renderer = null;
                currentProps = null;
                onOpenChange(false);
              },
            };
          },
        }),
      ];
    },
  });
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  /** Called when the slash command menu opens/closes so the parent can
   *  layer Escape (menu closes first, then the drawer). */
  onSlashMenuOpenChange?: (open: boolean) => void;
  /**
   * Upload handler. Required for /image, /attachment, drag-drop, and paste
   * to work; if absent, those flows show a toast and bail. Returns the
   * persisted attachment so the editor can insert the right node.
   */
  onUploadFile?: UploadFileFn;
  /** Optional toast callback for upload errors (size, network, etc.). */
  onUploadError?: (message: string) => void;
  placeholder?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

interface PopoverState {
  open: boolean;
  imageOnly: boolean;
  anchor: { x: number; y: number } | null;
}

export function RichDescriptionEditor({
  value,
  onChange,
  onSlashMenuOpenChange,
  onUploadFile,
  onUploadError,
  placeholder = 'Definition of done, context, links, notes…',
}: Props) {
  // Latest callbacks in refs so the editor (created once) always sees the
  // current handler without re-creating itself on every render.
  const openChangeRef = useRef(onSlashMenuOpenChange);
  openChangeRef.current = onSlashMenuOpenChange;
  const uploadRef = useRef(onUploadFile);
  uploadRef.current = onUploadFile;
  const errorRef = useRef(onUploadError);
  errorRef.current = onUploadError;

  // Tracks what value we last pushed into the editor (or the editor last
  // emitted). Without this, a plain-text `value` like "Hello" would never
  // equal the editor's normalized HTML "<p>Hello</p>", and the sync effect
  // would loop `setContent` on every render.
  const lastKnownValueRef = useRef<string | null>(null);

  // Popover state (set by /image and /attachment slash commands).
  const [popover, setPopover] = useState<PopoverState>({
    open: false,
    imageOnly: false,
    anchor: null,
  });

  /**
   * Upload + insert a single file at the current cursor (or `at` if given).
   * Pure helper — used by drop / paste / popover-pick. Inserts an image
   * node for image/* MIME types and an attachment node for everything else.
   */
  const uploadAndInsert = useCallback(async (editor: Editor, file: File, at?: number) => {
    const upload = uploadRef.current;
    if (!upload) {
      errorRef.current?.('Uploads are not enabled here.');
      return;
    }
    if (file.size > MAX_BYTES) {
      errorRef.current?.(`"${file.name}" is too large (max 10 MB).`);
      return;
    }
    try {
      const att = await upload(file);
      const isImage = att.mimeType.startsWith('image/');
      const insertPos = at ?? editor.state.selection.from;
      if (isImage) {
        editor
          .chain()
          .focus()
          .insertContentAt(insertPos, {
            type: 'image',
            attrs: { src: att.url, alt: att.name },
          })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .insertContentAt(insertPos, {
            type: 'attachment',
            attrs: {
              id: att.id,
              name: att.name,
              mimeType: att.mimeType,
              size: att.size,
              isLoading: false,
            } satisfies AttachmentAttrs,
          })
          .run();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      errorRef.current?.(msg);
    }
  }, []);

  // Slash items are stable for the lifetime of the editor — `command`
  // closes over the popover setter (stable via setState identity).
  const slashItemsRef = useRef<SlashItem[]>([]);
  slashItemsRef.current = [
    {
      id: 'h1',
      title: 'Heading 1',
      description: 'Large section heading',
      keywords: ['h1', 'heading', 'title', 'big'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
      },
    },
    {
      id: 'h2',
      title: 'Heading 2',
      description: 'Medium section heading',
      keywords: ['h2', 'heading', 'subtitle'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
      },
    },
    {
      id: 'todo',
      title: 'Todo',
      description: 'Checkbox list item',
      keywords: ['todo', 'task', 'check', 'checkbox', 'checklist'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleList('taskList', 'taskItem').run();
      },
    },
    {
      id: 'image',
      title: 'Image',
      description: 'Upload an image',
      keywords: ['image', 'img', 'picture', 'photo', 'screenshot'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        setPopover({
          open: true,
          imageOnly: true,
          anchor: { x: coords.left, y: coords.bottom + 4 },
        });
      },
    },
    {
      id: 'attachment',
      title: 'Attachment',
      description: 'Upload a file',
      keywords: ['attachment', 'file', 'upload', 'doc'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        setPopover({
          open: true,
          imageOnly: false,
          anchor: { x: coords.left, y: coords.bottom + 4 },
        });
      },
    },
  ];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Heading.configure({ levels: [1, 2] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageWithAuth,
      AttachmentNode,
      // The slash extension reads from the ref so adding/removing items
      // doesn't require re-creating the editor instance.
      createSlashExtension(slashItemsRef.current, (open) => {
        openChangeRef.current?.(open);
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        'data-placeholder': placeholder,
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        const dropPos = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const editorInstance = view as unknown as { editable: boolean };
        if (!editorInstance.editable) return false;
        for (const f of files) {
          void uploadAndInsert(editor!, f, dropPos?.pos);
        }
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        for (const f of files) {
          void uploadAndInsert(editor!, f);
        }
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastKnownValueRef.current = html;
      onChange(html);
    },
    // editor identity is stable; we recreate only when extension list changes
    // (which it doesn't — slash items live in a ref).
  });

  // Capture the editor's initial HTML once it's ready so the first run of
  // the value-sync effect below doesn't loop when `value` was plain text.
  useEffect(() => {
    if (editor && lastKnownValueRef.current === null) {
      lastKnownValueRef.current = value || '';
    }
  }, [editor, value]);

  // Sync external `value` into the editor when a new task is loaded (or
  // any other external mutation of value). Skip if the incoming value is
  // what we last saw — avoids the plain-text-vs-HTML loop described above.
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    const next = value || '';
    if (lastKnownValueRef.current === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
    lastKnownValueRef.current = next;
  }, [editor, value]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="task-description-editor">
      <EditorContent editor={editor} />
      <UploadPopover
        open={popover.open}
        imageOnly={popover.imageOnly}
        anchor={popover.anchor}
        onClose={() => setPopover((p) => ({ ...p, open: false }))}
        onPick={(file) => {
          if (editor) void uploadAndInsert(editor, file);
        }}
      />
    </div>
  );
}

/** Treat Tiptap's "empty document" HTML as actually empty for dirty / save. */
export function isEmptyEditorHtml(html: string): boolean {
  const trimmed = html.trim();
  if (!trimmed) return true;
  // Tiptap emits <p></p> for an empty doc, sometimes with <br class="ProseMirror-trailingBreak">.
  const stripped = trimmed.replace(/\s+/g, '');
  return (
    stripped === '<p></p>' ||
    stripped === '<p><br></p>' ||
    stripped === '<p><brclass="ProseMirror-trailingBreak"></p>'
  );
}
