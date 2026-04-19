import { useUiStore } from '../store/ui';

interface Shortcut {
  keys: string[];
  label: string;
}

interface Section {
  title: string;
  description: string;
  rows: Shortcut[];
}

const SECTIONS: Section[] = [
  {
    title: 'Global',
    description: 'Work from anywhere in the app.',
    rows: [
      { keys: ['/'], label: 'Focus input bar' },
      { keys: ['n'], label: 'New thing (focus input or fire "new" in context)' },
      { keys: ['Esc'], label: 'Blur input / close modal' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['⌘', 'K'], label: 'Command palette' },
      { keys: ['g', 'd'], label: 'Plan My Day (⌘P blocked by browser)' },
      { keys: ['g', 'r'], label: 'End of Day Review (⌘R blocked by browser)' },
      { keys: ['g', 'w'], label: 'Weekly Stats (⌘W blocked by browser)' },
      { keys: ['⌘', 'E'], label: 'Export data' },
      { keys: ['⌘', 'I'], label: 'Import data' },
      { keys: ['@'], label: 'Focus person filter (where available)' },
      { keys: ['1', '–', '9'], label: 'Filter by role (Today · Backlog · Parkings · Team)' },
      { keys: ['0'], label: 'Show all roles' },
    ],
  },
  {
    title: 'View navigation',
    description: 'Jump between views without touching the mouse.',
    rows: [
      { keys: ['g', 't'], label: 'Go to Today (Tasks)' },
      { keys: ['g', 'l'], label: 'Go to Backlog (list)' },
      { keys: ['g', 'p'], label: 'Go to Parkings' },
      { keys: ['g', 'u'], label: 'Go to Team (Team Task View)' },
      { keys: ['g', 'b'], label: 'Go to Brands' },
      { keys: ['g', 'i'], label: 'Go to Inbox' },
      { keys: ['g', 'd'], label: 'Open Plan My Day' },
      { keys: ['g', 'r'], label: 'Open End of Day Review' },
      { keys: ['g', 'w'], label: 'Open Weekly Stats' },
      { keys: ['⌘', 'B'], label: 'Go to Brands (modifier)' },
      { keys: [']'], label: 'Next view' },
      { keys: ['['], label: 'Previous view' },
    ],
  },
  {
    title: 'Today navigation',
    description: 'Move between tasks without touching the mouse.',
    rows: [
      { keys: ['j'], label: 'Next task' },
      { keys: ['k'], label: 'Previous task' },
      { keys: ['h'], label: 'Left column' },
      { keys: ['l'], label: 'Right column' },
      { keys: ['↑', '↓', '←', '→'], label: 'Arrow keys also work' },
    ],
  },
  {
    title: 'Task actions',
    description: 'With a task selected on the Today view.',
    rows: [
      { keys: ['Enter'], label: 'Advance task (Up Next → In Progress → Done)' },
      { keys: ['Space'], label: 'Complete task (any state → Done)' },
      { keys: ['e'], label: 'Edit task (open detail)' },
      { keys: ['r'], label: 'Change role' },
      { keys: ['A'], label: 'Assign to a teammate' },
      { keys: ['p'], label: 'Cycle priority (low → med → high)' },
      { keys: ['d'], label: 'Defer to tomorrow' },
      { keys: ['⌫'], label: 'Delete (with 5s undo)' },
    ],
  },
  {
    title: 'Backlog',
    description: 'On the Backlog view, with a task selected.',
    rows: [
      { keys: ['j'], label: 'Next task' },
      { keys: ['k'], label: 'Previous task' },
      { keys: ['e'], label: 'Edit task (open detail)' },
    ],
  },
  {
    title: 'Parkings',
    description: 'On the Parkings view, with an item selected.',
    rows: [
      { keys: ['j'], label: 'Next parking' },
      { keys: ['k'], label: 'Previous parking' },
      { keys: ['Enter'], label: 'Expand / collapse details' },
      { keys: ['Space'], label: 'Mark discussed' },
      { keys: ['e'], label: 'Edit title inline' },
      { keys: ['r'], label: 'Change role' },
      { keys: ['v'], label: 'Toggle visibility (Team ↔ Private)' },
      { keys: ['I'], label: 'Pick involved teammates' },
      { keys: ['p'], label: 'Cycle priority' },
      { keys: ['d'], label: 'Defer to next day' },
      { keys: ['⌫'], label: 'Delete (with 5s undo)' },
    ],
  },
  {
    title: 'Brands',
    description: 'On the Brands detail view.',
    rows: [
      { keys: ['1'], label: 'Overview tab' },
      { keys: ['2'], label: 'Action Items & Meetings tab' },
      { keys: ['3'], label: 'Feature Requests tab' },
      { keys: ['f'], label: 'Feature Requests tab (alias)' },
      { keys: ['s'], label: 'Sync recordings' },
    ],
  },
  {
    title: 'Feature Requests',
    description: 'On the Feature Requests tab within a brand.',
    rows: [
      { keys: ['n'], label: 'New feature request' },
      { keys: ['j', '/', 'k'], label: 'Navigate rows' },
      { keys: ['Space'], label: 'Toggle resolved' },
      { keys: ['r'], label: 'Sync with spreadsheet' },
      { keys: ['Esc'], label: 'Deselect row' },
    ],
  },
  {
    title: 'Sync Review',
    description: 'Inside the recording sync review modal.',
    rows: [
      { keys: ['j', '/', 'k'], label: 'Navigate candidates' },
      { keys: ['Enter'], label: 'Toggle selection' },
      { keys: ['⌘', 'Enter'], label: 'Confirm and sync' },
      { keys: ['Esc'], label: 'Close without syncing' },
    ],
  },
  {
    title: 'Team Task View',
    description: 'On the /team page — one column per teammate, task status shown as a tag.',
    rows: [
      { keys: ['j'], label: 'Next task' },
      { keys: ['k'], label: 'Previous task' },
      { keys: ['h'], label: 'Previous teammate' },
      { keys: ['l'], label: 'Next teammate' },
      { keys: ['[', ']'], label: 'Previous / next teammate (alias)' },
      { keys: ['f'], label: 'Cycle date scope (Today → Week → All)' },
      { keys: ['e'], label: 'Edit task (open drawer)' },
      { keys: ['A'], label: 'Reassign selected task' },
      { keys: ['Esc'], label: 'Close drawer' },
    ],
  },
  {
    title: 'Inbox',
    description: 'On the /inbox page.',
    rows: [
      { keys: ['j'], label: 'Next event' },
      { keys: ['k'], label: 'Previous event' },
      { keys: ['Enter'], label: 'Open entity + mark read' },
      { keys: ['Space'], label: 'Mark the selected event read' },
      { keys: ['m', 'a'], label: 'Mark all read' },
    ],
  },
  {
    title: 'Weekly Stats',
    description: 'Inside the Weekly Stats modal.',
    rows: [
      { keys: ['['], label: 'Switch to Mine tab' },
      { keys: [']'], label: 'Switch to Team tab' },
      { keys: ['Esc'], label: 'Close' },
    ],
  },
];

export function ShortcutsModal() {
  const close = useUiStore((s) => s.closeModal);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl border border-border bg-background shadow-2xl animate-scaleIn overflow-hidden">
        {/* accent glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-30"
          style={{
            background: 'radial-gradient(circle, var(--glow-accent) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{
            background: 'radial-gradient(circle, var(--glow-secondary) 0%, transparent 70%)',
          }}
        />

        <header className="relative flex items-start justify-between px-6 pt-6 pb-5 border-b border-border/60">
          <div>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-primary/40 text-[10px] uppercase tracking-widest text-primary mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Keyboard-first
            </div>
            <h2 className="text-xl font-semibold text-foreground">Shortcuts</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Press <Kbd subtle>?</Kbd> anywhere to reopen this. Press <Kbd subtle>Esc</Kbd> to
              close.
            </p>
          </div>
          <button
            onClick={close}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="relative overflow-y-auto max-h-[calc(85vh-132px)] px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
            {SECTIONS.map((section, sectionIdx) => (
              <section
                key={section.title}
                className="animate-slideUp"
                style={{ animationDelay: `${80 + sectionIdx * 60}ms` }}
              >
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                  {section.title}
                </h3>
                <p className="text-xs text-muted-foreground/70 mt-0.5 mb-3">
                  {section.description}
                </p>
                <ul className="space-y-2">
                  {section.rows.map((row) => (
                    <li key={row.label} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {row.keys.map((k, i) => (
                          <Kbd key={i}>{k}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children, subtle = false }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <kbd
      className={
        subtle
          ? 'inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 rounded border border-border bg-card text-[10px] font-mono text-muted-foreground'
          : 'inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded-md border border-border bg-gradient-to-b from-[var(--kbd-from)] to-[var(--kbd-to)] text-2xs font-mono text-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.2),0_1px_0_rgba(255,255,255,0.05)]'
      }
    >
      {children}
    </kbd>
  );
}
