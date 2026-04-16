/**
 * Release notes — the source of truth for the "What's new" modal.
 *
 * Whenever a user-visible change ships, prepend a new entry to RELEASE_NOTES
 * (see CLAUDE.md → "Keep release notes in sync" for the full rules).
 * Entries must be in reverse-chronological order: newest first.
 */

export interface ReleaseItem {
  title: string;
  description: string;
  /** Keyboard shortcut tokens, e.g. ["Cmd", "K"] or ["Tab"]. Rendered as stacked keycaps. */
  shortcuts?: string[];
  /** Optional one-liner of how to try the feature right now. */
  howTo?: string;
}

export interface ReleaseNote {
  version: string;
  date: string; // YYYY-MM-DD
  headline: string;
  summary: string;
  items: ReleaseItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '0.2.5',
    date: '2026-04-15',
    headline: 'Global shortcuts work from every view',
    summary:
      'Backlog (and any future view) now responds to g/[/] and every other global shortcut. Previously those only worked on pages that happened to call the keyboard-controller hook.',
    items: [
      {
        title: 'Global shortcuts moved out of individual pages',
        description:
          'View navigation, the command palette, role filtering, and every other global keyboard shortcut are now registered at the app shell level, which means they fire identically from Today, Backlog, and Parkings. Pages continue to own their own navigation keys (j/k/h/l) and task actions (Enter/Space/e/r/p/d/Delete).',
        shortcuts: ['g', 'b'],
        howTo:
          'Navigate to Backlog and press g t or [ / ] — it now works, same as from Today and Parkings.',
      },
    ],
  },
  {
    version: '0.2.4',
    date: '2026-04-15',
    headline: 'View navigation actually works from every page',
    summary:
      'The g / [ / ] view-navigation shortcuts were silently broken on pages where the input bar auto-focused on mount — which was every task and parking page. Fixed.',
    items: [
      {
        title: 'No more auto-focused input bars',
        description:
          'Tasks and Parkings no longer grab focus on the input bar when you land on them. That used to swallow g-prefix and bracket shortcuts, so pressing g t from Parkings did nothing. Press / to focus the input when you want to capture something — the same way you already focus it from anywhere else in the app.',
        shortcuts: ['/'],
        howTo:
          'Land on any view, press g t / g b / g p to jump, or [ and ] to cycle. When you want to type a new task or parking, tap / first to focus the input bar.',
      },
    ],
  },
  {
    version: '0.2.3',
    date: '2026-04-15',
    headline: 'Tab key restored to the browser, new view-switching bindings',
    summary:
      'Tab no longer cycles views — it hands control back to the browser for focus-ring and screen-reader navigation, the way it should. View switching moved to vim-style “go to” bindings and bracket cycling.',
    items: [
      {
        title: 'Tab is free again',
        description:
          'Tab used to hijack focus to cycle Today → Backlog → Parkings. That broke accessibility and normal browser focus flow. It now does exactly what every web app expects: move focus to the next focusable element.',
      },
      {
        title: '“Go to” bindings for direct view jumps',
        description:
          'Press g then a letter to jump directly to any view. This is vim-style navigation — hold nothing, tap g, then tap the destination within 1.5 seconds. Pressing g twice cancels the pending state.',
        shortcuts: ['g', 't'],
        howTo:
          'g t for Today (Tasks), g b for Backlog, g p for Parkings. Works anywhere as long as you’re not typing into an input.',
      },
      {
        title: 'Bracket keys for previous / next view',
        description:
          'If you prefer cycling over direct jumps, press ] to move to the next view and [ to move to the previous one. Order: Today → Backlog → Parkings → Today.',
        shortcuts: [']'],
      },
    ],
  },
  {
    version: '0.2.2',
    date: '2026-04-15',
    headline: 'Shortcuts help is actually accurate now',
    summary:
      'The Shortcuts modal was drifting from reality — Parkings were missing, the Tab binding was wrong, and a dead row was still listed. All fixed, with a new rule to keep them in sync going forward.',
    items: [
      {
        title: 'Parkings shortcuts documented',
        description:
          'The Shortcuts help (press ? anywhere or open the command palette → Keyboard Shortcuts) now has a dedicated Parkings section listing every binding: navigation, expand/collapse, mark discussed, change role, cycle priority, defer, delete.',
        shortcuts: ['?'],
      },
      {
        title: 'Corrected the Tab binding label',
        description:
          'Tab has cycled Today → Backlog → Parkings → Today since v0.2.0, but the help still said “Toggle Today ↔ Backlog.” Fixed. Also removed a ghost row for a “t – Move to today” shortcut that was never actually wired up.',
      },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-04-15',
    headline: 'Slimmer sidebar, Today/Backlog tabs on Tasks',
    summary:
      'The sidebar is now a thin icon rail reserved for top-level destinations. Today and Backlog moved to a sub-tab bar inside Tasks.',
    items: [
      {
        title: 'Icon-only sidebar',
        description:
          'The sidebar shrank from a text rail to a 56-pixel icon rail. Only top-level destinations live there now — Tasks and Parkings — plus What’s new, Shortcuts, theme, and sign out at the bottom. Hover any icon to see its label. The Momentum mark at the top links back to the current app version.',
      },
      {
        title: 'Today / Backlog tabs moved to the Tasks view',
        description:
          'Today and Backlog are no longer sidebar items — they are now tabs at the top of the Tasks area. The active tab gets an accent underline. Tab key cycles Today → Backlog → Parkings → Today, same as before.',
        shortcuts: ['Tab'],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-04-15',
    headline: 'Sidebar, Parkings, and this “What’s new” page',
    summary:
      'A persistent left sidebar, a new Parkings view for daily standup prep, and release notes that land the moment you update.',
    items: [
      {
        title: 'New sidebar navigation',
        description:
          'The old top-nav tabs are gone. A persistent left sidebar groups Tasks (Today, Backlog) and Parkings, with your profile, theme toggle, and sign-out tucked at the bottom. Tab still cycles — now it rotates through all three views.',
        shortcuts: ['Tab'],
      },
      {
        title: 'Parkings for your daily standups',
        description:
          'Capture topics you want to bring up at the next daily standup. Each parking has a title, prep notes, and an outcome you fill in after the conversation. Items are grouped by daily date — Today, Tomorrow, future days, and Unscheduled.',
        shortcuts: ['Enter', 'Space', 'e', 'r', 'p', 'd'],
        howTo:
          'Open Parkings from the sidebar (or Tab to it), type a topic the same way you type tasks. Use +tomorrow / +mon to target a specific daily. Expand a card with Enter to write prep notes. Press Space after the discussion to mark it done.',
      },
      {
        title: '“What’s new” experience',
        description:
          'Release notes auto-open the first time you visit after an update. You can reopen them anytime from the sidebar or the command palette under Help. A subtle accent dot on the sidebar link tells you when an unseen release is waiting.',
        shortcuts: ['Cmd', 'K'],
      },
    ],
  },
];

export const LATEST_VERSION: string = RELEASE_NOTES[0]!.version;

/** Compare two version strings as dotted integers ("0.2.0" < "0.10.0"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}
