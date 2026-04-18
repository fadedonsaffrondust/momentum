import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Command } from './types';

interface CommandsContextValue {
  /** Stable-identity snapshot of currently-registered commands. */
  commands: readonly Command[];
  /** Register a command. Returns an unregister function. */
  register: (command: Command) => () => void;
}

const CommandsContext = createContext<CommandsContextValue | null>(null);

export function CommandsProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef(new Map<string, Command>());
  const [version, setVersion] = useState(0);

  const register = useCallback((command: Command) => {
    mapRef.current.set(command.id, command);
    setVersion((v) => v + 1);
    return () => {
      const existing = mapRef.current.get(command.id);
      // Guard against stale unregister overwriting a newer registration
      // with the same id — we only unregister if the object identity matches.
      if (existing === command) {
        mapRef.current.delete(command.id);
        setVersion((v) => v + 1);
      }
    };
  }, []);

  const commands = useMemo(
    () => Array.from(mapRef.current.values()),
    // `version` bumps whenever the map mutates; `mapRef.current` identity
    // never changes, so this is how we re-derive the snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const value = useMemo<CommandsContextValue>(
    () => ({ commands, register }),
    [commands, register],
  );

  return (
    <CommandsContext.Provider value={value}>{children}</CommandsContext.Provider>
  );
}

export function useCommands(): readonly Command[] {
  const ctx = useContext(CommandsContext);
  if (!ctx) {
    throw new Error('useCommands must be used inside <CommandsProvider>');
  }
  return ctx.commands;
}

/**
 * Register one or more commands for the lifetime of the calling component.
 * The `deps` array follows useEffect semantics — if any dep changes, commands
 * are re-registered (old entries with the same id are overwritten by new).
 *
 * Pass `commands` as a stable array (memoize if computed) to avoid churn.
 */
export function useRegisterCommands(
  commands: readonly Command[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: readonly any[] = [],
): void {
  const ctx = useContext(CommandsContext);
  if (!ctx) {
    throw new Error('useRegisterCommands must be used inside <CommandsProvider>');
  }
  const { register } = ctx;

  useEffect(() => {
    const unregs = commands.map((cmd) => register(cmd));
    return () => {
      unregs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
