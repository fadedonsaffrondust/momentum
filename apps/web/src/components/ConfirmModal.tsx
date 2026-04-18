import { useCallback, useEffect, useRef, useState } from 'react';

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

let globalShow: ((message: string) => Promise<boolean>) | null = null;

export function confirm(message: string): Promise<boolean> {
  if (!globalShow) return Promise.resolve(false);
  return globalShow(message);
}

export function ConfirmProvider() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const show = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  const handleResult = useCallback(
    (result: boolean) => {
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  useEffect(() => {
    globalShow = show;
    return () => { globalShow = null; };
  }, [show]);

  if (!state) return null;
  return <ConfirmModal message={state.message} onResult={handleResult} />;
}

interface Props {
  message: string;
  onResult: (confirmed: boolean) => void;
}

export function ConfirmModal({ message, onResult }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onResult(false);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onResult]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn"
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirmation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onResult(false);
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-background shadow-2xl animate-scaleIn">
        <div className="px-5 py-5">
          <p className="text-sm text-foreground leading-relaxed">{message}</p>
        </div>
        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/60">
          <button
            ref={cancelRef}
            onClick={() => onResult(false)}
            className="px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-secondary transition focus:outline-none focus:border-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => onResult(true)}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-sm text-white transition focus:outline-none focus:ring-1 focus:ring-red-400"
          >
            Confirm
          </button>
        </footer>
      </div>
    </div>
  );
}
