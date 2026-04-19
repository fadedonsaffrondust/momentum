import { useEffect, useRef } from 'react';
import { Extension, ReactRenderer } from '@tiptap/react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { cn } from '@/lib/utils';

/**
 * Notion-style rich-text editor for task descriptions. Supports a minimal
 * set of block types (paragraph, heading 1–2, checklist) and an inline
 * slash-command menu: type `/` to open a picker, navigate with arrow keys,
 * Enter to apply, Esc to close.
 *
 * Storage is HTML — keeps existing plain-text descriptions working
 * (they load as a single paragraph) and round-trips cleanly.
 */

interface SlashItem {
  id: 'h1' | 'h2' | 'todo';
  title: string;
  description: string;
  keywords: string[];
  command: (ctx: { editor: Editor; range: { from: number; to: number } }) => void;
}

const SLASH_ITEMS: SlashItem[] = [
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
];

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
 * Build the Slash extension. We factor it as a function so the callback
 * that reports open/close state to the parent component can close over
 * the caller's setter without forcing the extension into a React context.
 */
function createSlashExtension(onOpenChange: (open: boolean) => void) {
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
            if (!q) return SLASH_ITEMS;
            return SLASH_ITEMS.filter(
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
                // Clamp the active index in case the list shrunk.
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
  placeholder?: string;
}

export function RichDescriptionEditor({
  value,
  onChange,
  onSlashMenuOpenChange,
  placeholder = 'Definition of done, context, links, notes…',
}: Props) {
  // Latest callback in a ref so the extension, created once, always sees
  // the current callback without re-creating the editor on every render.
  const openChangeRef = useRef(onSlashMenuOpenChange);
  openChangeRef.current = onSlashMenuOpenChange;

  // Tracks what value we last pushed into the editor (or the editor last
  // emitted). Without this, a plain-text `value` like "Hello" would never
  // equal the editor's normalized HTML "<p>Hello</p>", and the sync effect
  // would loop `setContent` on every render.
  const lastKnownValueRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep bulletList / orderedList / listItem — they ship with input
        // rules for `- ` and `1. ` that convert typed prefixes into real
        // lists. Everything else we don't use stays disabled.
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
      createSlashExtension((open) => {
        openChangeRef.current?.(open);
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastKnownValueRef.current = html;
      onChange(html);
    },
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
  // what we last saw — avoids the plain-text-vs-HTML loop described
  // above.
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
