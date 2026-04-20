import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: string) => void;
  isBusy: boolean;
  placeholder?: string;
  /** Upper bound matches @momentum/shared's jarvisPostMessageInputSchema (20_000). */
  maxLength?: number;
}

export interface ComposerHandle {
  focus: () => void;
  blur: () => void;
}

/**
 * Textarea composer for the /messages endpoint. Enter sends; Shift+Enter
 * inserts a newline; Cmd+Enter (or Ctrl+Enter) also sends — the Cmd
 * alternate is the spec's compromise for users whose IME or OS
 * intercepts plain Enter. Autosize grows up to ~10 lines then scrolls.
 *
 * Keyboard integration at the page level (`/` to focus, `Esc` to blur)
 * lives in Task 11's `useJarvisKeyboardController`. This component
 * exposes a ref handle so the controller can call `.focus()` / `.blur()`.
 */
export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, onChange, onSubmit, isBusy, placeholder, maxLength = 20_000 },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
  }));

  // Autosize: reset to auto to collect scrollHeight, then apply. Capped
  // at 10 lines of text; overflow scrolls inside the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 10 * 20; // line-height * max lines
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  }, [value]);

  const handleSend = () => {
    const content = value.trim();
    if (!content || isBusy || content.length > maxLength) return;
    onSubmit(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnter = e.key === 'Enter';
    if (!isEnter) return;
    if (e.shiftKey) return; // newline
    if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl+Enter alternate-send
      e.preventDefault();
      handleSend();
      return;
    }
    // Plain Enter: send
    e.preventDefault();
    handleSend();
  };

  const disabled = isBusy || value.trim().length === 0;

  return (
    <form
      className="border-t border-border bg-background px-4 pb-4 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
    >
      <div
        className={cn(
          'relative flex items-end gap-2 rounded-md border bg-card px-3 py-2 transition-colors duration-150',
          'focus-within:border-primary/60',
          'border-border',
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Ask Jarvis — use Enter to send, Shift+Enter for a newline'}
          disabled={isBusy}
          maxLength={maxLength}
          rows={1}
          data-jarvis-composer="true"
          className="min-h-[20px] w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-progress disabled:opacity-60"
          aria-label="Message Jarvis"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label="Send message"
          className={cn(
            'shrink-0 rounded-sm p-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
            disabled
              ? 'text-muted-foreground/60'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </form>
  );
});
