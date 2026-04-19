import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface PropertyPickerItem<V extends string = string> {
  value: V;
  label: string;
  /** Optional leading visual rendered in both the list row and the trigger. */
  leading?: ReactNode;
  /** Trailing muted hint (e.g. "you"). */
  hint?: string;
  /** Additional search keywords beyond the visible label. */
  keywords?: string[];
}

interface Props<V extends string> {
  /** The trigger contents (rendered inside a button). Usually leading icon + current label. */
  children: ReactNode;
  items: PropertyPickerItem<V>[];
  value: V | null;
  onChange: (value: V) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Popover alignment relative to the trigger. Default `start`. */
  align?: 'start' | 'center' | 'end';
  /** Extra classes on the popover content (e.g. fixed width overrides). */
  contentClassName?: string;
  /** Tailwind class on the trigger button. */
  triggerClassName?: string;
}

/**
 * Shared dropdown / picker UI for task properties (priority, role, assignee,
 * anything with a discrete list of options). Built on shadcn `Popover` +
 * `Command` so every picker shares the same keyboard model: ↑/↓ to move,
 * Enter to select, Escape to close, optional search on top.
 *
 * The trigger is an inline button (no modal, no `<select>`), so all pickers
 * in the task detail drawer look and feel the same.
 */
export function PropertyPicker<V extends string>({
  children,
  items,
  value,
  onChange,
  searchable = false,
  searchPlaceholder,
  emptyLabel = 'No results.',
  align = 'start',
  contentClassName,
  triggerClassName,
}: Props<V>) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex-1 min-w-0 flex items-center gap-2 text-left rounded-sm px-1 -mx-1 py-0.5',
            'hover:bg-background/60 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            triggerClassName,
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className={cn('w-64 p-0', contentClassName)}>
        <Command>
          {searchable && (
            <CommandInput placeholder={searchPlaceholder ?? 'Search…'} />
          )}
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {items.map((item) => (
              <CommandItem
                key={item.value}
                // cmdk uses `value` for filtering; include label + keywords.
                value={[item.label, ...(item.keywords ?? [])].join(' ')}
                onSelect={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                {item.leading}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && (
                  <span className="text-2xs text-muted-foreground">{item.hint}</span>
                )}
                {value === item.value && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
