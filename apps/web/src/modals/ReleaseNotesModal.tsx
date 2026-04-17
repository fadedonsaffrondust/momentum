import { useEffect, useState } from 'react';
import { useUiStore } from '../store/ui';
import { RELEASE_NOTES, type ReleaseNote } from '../lib/releaseNotes';
import { markReleaseSeen } from '../hooks/useReleaseNotesPrompt';

export function ReleaseNotesModal() {
  const closeStore = useUiStore((s) => s.closeModal);
  const [index, setIndex] = useState(0);
  const note: ReleaseNote | undefined = RELEASE_NOTES[index];

  // Mark the newest version as seen as soon as the modal opens.
  useEffect(() => {
    markReleaseSeen();
  }, []);

  // Left / right to browse history.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeStore();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.min(RELEASE_NOTES.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeStore]);

  if (!note) {
    return (
      <Overlay onClose={closeStore}>
        <div className="p-6 text-sm text-m-fg-muted">No release notes yet.</div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={closeStore}>
      <div className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl border border-m-border bg-m-bg shadow-2xl animate-scaleIn overflow-hidden">
        {/* accent glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, var(--m-glow-accent) 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, var(--m-glow-secondary) 0%, transparent 70%)' }}
        />

        <header className="relative flex items-start justify-between px-6 pt-6 pb-5 border-b border-m-border-subtle">
          <div>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-accent/40 text-[10px] uppercase tracking-widest text-accent mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              v{note.version} · {note.date}
            </div>
            <h2 className="text-xl font-semibold text-m-fg">{note.headline}</h2>
            <p className="text-xs text-m-fg-muted mt-1 max-w-lg">{note.summary}</p>
          </div>
          <button
            onClick={closeStore}
            className="text-m-fg-muted hover:text-m-fg transition"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="relative overflow-y-auto max-h-[calc(85vh-200px)] px-6 py-5">
          <div className="space-y-4">
            {note.items.map((item, i) => (
              <article
                key={item.title}
                className="rounded-xl border border-m-border-subtle bg-m-surface-40 p-4 animate-slideUp"
                style={{ animationDelay: `${80 + i * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-m-fg">{item.title}</h3>
                  {item.shortcuts && item.shortcuts.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      {item.shortcuts.map((k, j) => (
                        <Kbd key={j}>{k}</Kbd>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-m-fg-tertiary mt-2 leading-relaxed">{item.description}</p>
                {item.howTo && (
                  <div className="mt-3 pt-3 border-t border-m-border-subtle flex items-start gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-accent font-semibold shrink-0">
                      Try it
                    </span>
                    <span className="text-xs text-m-fg-tertiary">{item.howTo}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        <footer className="relative flex items-center justify-between px-6 py-3 border-t border-m-border-subtle bg-m-bg">
          <span className="text-[10px] text-m-fg-dim">
            {index + 1} of {RELEASE_NOTES.length}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-m-fg-dim">
            <Kbd>←</Kbd>
            <span>older</span>
            <Kbd>→</Kbd>
            <span>newer</span>
            <Kbd>Esc</Kbd>
            <span>close</span>
          </div>
        </footer>
      </div>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="What's new"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded-md border border-m-border-strong bg-gradient-to-b from-[var(--m-kbd-from)] to-[var(--m-kbd-to)] text-[11px] font-mono text-m-fg shadow-[inset_0_-1px_0_rgba(0,0,0,0.2),0_1px_0_rgba(255,255,255,0.05)]">
      {children}
    </kbd>
  );
}
