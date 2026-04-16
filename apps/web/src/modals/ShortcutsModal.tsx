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
      { keys: ['Esc'], label: 'Blur input / close modal' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['⌘', 'K'], label: 'Command palette' },
      { keys: ['⌘', 'P'], label: 'Plan My Day' },
      { keys: ['⌘', 'R'], label: 'End of Day Review' },
      { keys: ['⌘', 'W'], label: 'Weekly Stats' },
      { keys: ['⌘', 'E'], label: 'Export data' },
      { keys: ['⌘', 'I'], label: 'Import data' },
      { keys: ['1', '–', '9'], label: 'Filter by role' },
      { keys: ['0'], label: 'Show all roles' },
    ],
  },
  {
    title: 'View navigation',
    description: 'Jump between Tasks and Parkings without touching the mouse.',
    rows: [
      { keys: ['g', 't'], label: 'Go to Today (Tasks)' },
      { keys: ['g', 'b'], label: 'Go to Backlog' },
      { keys: ['g', 'p'], label: 'Go to Parkings' },
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
      { keys: ['Enter'], label: 'Start task' },
      { keys: ['Space'], label: 'Complete task' },
      { keys: ['e'], label: 'Edit inline' },
      { keys: ['r'], label: 'Change role' },
      { keys: ['p'], label: 'Cycle priority (low → med → high)' },
      { keys: ['d'], label: 'Defer to tomorrow' },
      { keys: ['⌫'], label: 'Delete (with 5s undo)' },
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
      { keys: ['p'], label: 'Cycle priority' },
      { keys: ['d'], label: 'Defer to next day' },
      { keys: ['⌫'], label: 'Delete (with 5s undo)' },
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
      <div className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-scaleIn overflow-hidden">
        {/* accent glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-30"
          style={{
            background: 'radial-gradient(circle, #4F8EF7 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{
            background: 'radial-gradient(circle, #B184F7 0%, transparent 70%)',
          }}
        />

        <header className="relative flex items-start justify-between px-6 pt-6 pb-5 border-b border-zinc-900">
          <div>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-accent/40 text-[10px] uppercase tracking-widest text-accent mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Keyboard-first
            </div>
            <h2 className="text-xl font-semibold text-zinc-100">Shortcuts</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Press{' '}
              <Kbd subtle>?</Kbd> anywhere to reopen this. Press <Kbd subtle>Esc</Kbd> to close.
            </p>
          </div>
          <button
            onClick={close}
            className="text-zinc-500 hover:text-zinc-100 transition"
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
                <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
                  {section.title}
                </h3>
                <p className="text-xs text-zinc-600 mt-0.5 mb-3">{section.description}</p>
                <ul className="space-y-2">
                  {section.rows.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="text-zinc-400">{row.label}</span>
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
          ? 'inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 rounded border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-400'
          : 'inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded-md border border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-900 text-[11px] font-mono text-zinc-100 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.05)]'
      }
    >
      {children}
    </kbd>
  );
}
