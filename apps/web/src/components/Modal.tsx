import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useUiStore } from '../store/ui';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ title, onClose, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => prev?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className={clsx(
          'w-full max-w-2xl rounded-xl border border-m-border bg-m-bg shadow-2xl focus:outline-none',
          className,
        )}
      >
        <header className="px-5 py-3 border-b border-m-border-subtle flex items-center justify-between">
          <h2 className="text-sm text-m-fg-secondary">{title}</h2>
          <button
            onClick={onClose}
            className="text-m-fg-muted hover:text-m-fg-strong"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function useCloseModal() {
  return useUiStore((s) => s.closeModal);
}
