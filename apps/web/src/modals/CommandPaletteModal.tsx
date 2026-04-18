import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { useUiStore } from '@/store/ui';
import { useCommands } from '@/lib/commands/context';
import { loadRecents, pushRecent } from '@/lib/commands/recents';
import type { Command } from '@/lib/commands/types';

const RECENT_SECTION = 'Recent';

function renderShortcut(shortcut: string | undefined) {
  if (!shortcut) return null;
  const tokens = shortcut.split(' ').filter(Boolean);
  return (
    <CommandShortcut>
      <span className="inline-flex items-center gap-1">
        {tokens.map((t, i) => (
          <Kbd key={`${t}-${i}`}>{t}</Kbd>
        ))}
      </span>
    </CommandShortcut>
  );
}

function CommandRow({
  command,
  onRun,
}: {
  command: Command;
  onRun: (c: Command) => void;
}) {
  const Icon = command.icon;
  // cmdk uses textContent for fuzzy-match scoring. The `value` prop makes
  // id + label + description all searchable regardless of rendering.
  const value = [command.id, command.label, command.description ?? '']
    .join(' ')
    .toLowerCase();
  return (
    <CommandItem value={value} onSelect={() => onRun(command)}>
      {Icon ? (
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-foreground">{command.label}</span>
        {command.description ? (
          <span className="truncate text-2xs text-muted-foreground">
            {command.description}
          </span>
        ) : null}
      </div>
      {renderShortcut(command.shortcut)}
    </CommandItem>
  );
}

function groupBySection(commands: readonly Command[]): Map<string, Command[]> {
  const groups = new Map<string, Command[]>();
  for (const c of commands) {
    const list = groups.get(c.section);
    if (list) list.push(c);
    else groups.set(c.section, [c]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
  return groups;
}

export function CommandPaletteModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const allCommands = useCommands();
  const location = useLocation();

  const visible = useMemo(
    () => allCommands.filter((c) => !c.when || c.when(location.pathname)),
    [allCommands, location.pathname],
  );

  const recents = useMemo(() => {
    const ids = loadRecents();
    const byId = new Map(visible.map((c) => [c.id, c] as const));
    const list: Command[] = [];
    for (const id of ids) {
      const cmd = byId.get(id);
      if (cmd) list.push(cmd);
    }
    return list;
  }, [visible, activeModal]);

  const groups = useMemo(() => groupBySection(visible), [visible]);

  const handleRun = (command: Command) => {
    pushRecent(command.id);
    closeModal();
    // Defer run() to next tick so the dialog fully unmounts before any
    // navigation or state change — avoids flicker and Radix focus warnings.
    queueMicrotask(() => command.run());
  };

  const open = activeModal === 'command-palette';

  return (
    <CommandDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeModal();
      }}
    >
      <CommandInput placeholder="What do you want to do?" />
      <CommandList>
        <CommandEmpty>No commands match.</CommandEmpty>
        {recents.length > 0 ? (
          <CommandGroup heading={RECENT_SECTION}>
            {recents.map((c) => (
              <CommandRow
                key={`recent-${c.id}`}
                command={c}
                onRun={handleRun}
              />
            ))}
          </CommandGroup>
        ) : null}
        {Array.from(groups.entries()).map(([section, cmds]) => (
          <CommandGroup key={section} heading={section}>
            {cmds.map((c) => (
              <CommandRow key={c.id} command={c} onRun={handleRun} />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
