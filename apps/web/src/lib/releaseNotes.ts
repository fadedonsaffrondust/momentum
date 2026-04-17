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
    version: '0.5.0',
    date: '2026-04-16',
    headline: 'Brand detail view redesigned with tabbed layout',
    summary:
      'The brand detail page now uses a clean tabbed interface — Overview for the health snapshot, stakeholders, and goals; Action Items & Meetings for the working area. Better typography, spacing, and contrast throughout.',
    items: [
      {
        title: 'Tabbed Brand View',
        description:
          'The brand detail page is now split into an Overview tab and an Action Items & Meetings tab, eliminating the need to scroll through collapsed sections. Switch between them with a click or keyboard shortcuts.',
        shortcuts: ['1', '2'],
        howTo: 'Open any brand and use the tab bar below the header, or press 1 for Overview and 2 for Action Items & Meetings.',
      },
      {
        title: 'Stakeholder Cards',
        description:
          'Stakeholders are now displayed as a visual grid of cards showing name, role, and email — much easier to scan than the previous inline list.',
      },
      {
        title: 'Improved Readability',
        description:
          'All section labels, body text, and metadata have been bumped up in size and contrast for a more comfortable reading experience. No more squinting at 10px labels.',
      },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-04-16',
    headline: 'Smarter recording sync — no more duplicate action items',
    summary:
      'When syncing meeting recordings, extracted action items are now compared against your existing action items using AI. Duplicates are automatically skipped, and similar items are merged with updated details.',
    items: [
      {
        title: 'Action Item Deduplication',
        description:
          'During recording sync, Momentum uses an LLM to compare each extracted action item against your existing open items. Items that are essentially the same are skipped, items with new details are merged into the existing entry, and genuinely new items are created as before.',
        howTo:
          'Just sync recordings as usual — deduplication happens automatically. You\'ll see fewer duplicate action items after importing multiple recordings.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-04-15',
    headline: 'Meeting Recording Sync — pull transcripts into your brand notes',
    summary:
      'Sync meeting recordings into Momentum. Transcripts are automatically processed to extract summaries, action items, and decisions — all linked to the right brand.',
    items: [
      {
        title: 'Sync Recordings',
        description:
          'Click "Sync Recordings" on any brand to search your meeting recordings. Momentum scores each recording against your matching rules and shows likely and possible matches for you to review before importing.',
        shortcuts: ['s'],
        howTo:
          'Open a brand, click "Sync Recordings" or press s. Review the candidates, check the ones you want, and hit "Sync Selected".',
      },
      {
        title: 'Matching Rules',
        description:
          'Configure per-brand matching rules to control which recordings are surfaced. Match by stakeholder email, title keywords, meeting type, and sync window. Click the gear icon on a brand to configure.',
      },
      {
        title: 'AI-Powered Extraction',
        description:
          'Synced recordings are processed to extract a concise summary, action items with owners, and key decisions. Action items are automatically added to the brand.',
      },
      {
        title: 'Recording Links',
        description:
          'Meeting notes synced from recordings show a "Recording" link that opens the playback in a new tab.',
      },
      {
        title: 'Same-Day Merge',
        description:
          'If you already have manual notes for a day and sync a recording from that same day, the content is merged into one unified note — no duplicates.',
      },
      {
        title: 'Stakeholder Emails',
        description:
          'Stakeholders now support an email field. Adding emails to stakeholders improves recording matching accuracy.',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-04-15',
    headline: 'Brands — client management meets daily execution',
    summary:
      'A full Brands section for managing enterprise client relationships: meetings, stakeholders, action items, health tracking, AI-powered import, and bidirectional sync with your Today view.',
    items: [
      {
        title: 'Brand management',
        description:
          'Create and manage brands with three layers: North Star (goals, stakeholders, success definition), Pulse (activity snapshot, open action items, stakeholder badges), and Archive (meeting notes with decisions and extracted action items). Everything auto-saves on blur.',
        shortcuts: ['⌘', 'B'],
        howTo:
          'Press Cmd+B or g b to open Brands. Click "+ New Brand" to create one, then fill in goals and add stakeholders. Double-click the brand name to rename.',
      },
      {
        title: 'Meeting notes with action item extraction',
        description:
          'Log meetings with date, title, attendees (chip input with stakeholder autocomplete), notes, and decisions. Lines starting with → are automatically extracted as action items on save. Past titles autocomplete as you type.',
        shortcuts: ['n'],
        howTo:
          'Open a brand and press n (or click "+ New Meeting Note"). Write notes with → prefixed lines for action items. Press Cmd+Enter to save.',
      },
      {
        title: 'Send to Today — bidirectional sync',
        description:
          'Push any brand action item to your Today task list. Completing the task in Today auto-marks the action item done, and vice versa. The task card shows a linked badge.',
        howTo:
          'Hover an action item and click →Today, or use the "Send to Today" link in the Pulse section.',
      },
      {
        title: 'AI-powered brand import',
        description:
          'Upload a .md or .txt file of client notes and the server uses OpenAI to extract meetings, stakeholders, action items, goals, and success definition. Processing is async — you can keep working while it runs.',
        howTo:
          'Click "Import from file" in the Brands sidebar, select a file, click Analyze. The brand appears in the list with an importing spinner and auto-navigates to the detail view when done.',
      },
      {
        title: 'Health pills',
        description:
          'Each brand shows a computed health dot: green (on track), amber (quiet), red (needs attention). Based on meeting recency, open action item count, and overdue items.',
      },
      {
        title: 'Keyboard shortcuts updated',
        description:
          'g b now goes to Brands (Backlog moved to g l). Cmd+B is a modifier shortcut for Brands. Brands detail view supports n (new meeting) and a (new action item). View cycle updated to include Brands.',
        shortcuts: ['g', 'b'],
      },
    ],
  },
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
