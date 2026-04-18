import type { LucideIcon } from 'lucide-react';

/**
 * A single entry in the command palette. Pages register commands via
 * `useRegisterCommands`; globals are registered from `<GlobalCommands />`
 * inside `AppShell`.
 */
export interface Command {
  /** Stable id. Used for Recent persistence — do not change after shipping. */
  id: string;
  /** Short imperative label shown in the palette row. */
  label: string;
  /** Optional one-line description shown under the label. */
  description?: string;
  /** Lucide icon rendered on the left. */
  icon?: LucideIcon;
  /**
   * Human-readable shortcut hint rendered as `<Kbd>` on the right.
   * Use space-separated tokens: "Cmd K", "g t", "?".
   */
  shortcut?: string;
  /** Palette section heading (e.g. "Navigate", "Brand", "Daily"). */
  section: string;
  /**
   * Higher = earlier within its section. Defaults to 0.
   * Use this to pin frequently-used commands to the top of a section.
   */
  priority?: number;
  /**
   * Predicate deciding whether this command should appear given the
   * current location.pathname. If omitted, the command is always visible.
   */
  when?: (pathname: string) => boolean;
  /** Called when the palette item is activated. */
  run: () => void;
}
