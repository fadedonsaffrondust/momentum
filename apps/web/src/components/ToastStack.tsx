import clsx from 'clsx';
import { useUiStore } from '../store/ui';

export function ToastStack() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'px-4 py-3 rounded-md shadow-lg border text-sm flex items-start gap-3',
            'bg-zinc-900/95 backdrop-blur',
            t.kind === 'error' && 'border-red-500/50',
            t.kind === 'success' && 'border-green-500/50',
            t.kind === 'info' && 'border-zinc-700',
          )}
        >
          <span className="flex-1">{t.message}</span>
          {t.actionLabel && (
            <button
              onClick={() => {
                t.onAction?.();
                dismiss(t.id);
              }}
              className="text-accent hover:underline"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            onClick={() => dismiss(t.id)}
            className="text-zinc-500 hover:text-zinc-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
