import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useConnectFeatureRequestSheet } from '../../../api/hooks';
import { useUiStore } from '../../../store/ui';

interface Props {
  brandId: string;
  brandName: string;
  onClose: () => void;
}

type Phase = 'input' | 'connecting' | 'done' | 'error';

export function ConnectSheetModal({ brandId, brandName, onClose }: Props) {
  const connectSheet = useConnectFeatureRequestSheet(brandId);
  const pushToast = useUiStore((s) => s.pushToast);

  const [phase, setPhase] = useState<Phase>('input');
  const [sheetUrl, setSheetUrl] = useState('');
  const [standardize, setStandardize] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValidUrl = sheetUrl.includes('docs.google.com/spreadsheets/d/');

  const handleConnect = () => {
    if (!isValidUrl) return;
    setPhase('connecting');
    setErrorMessage('');

    connectSheet.mutate(
      { sheetUrl, standardize },
      {
        onSuccess: (res) => {
          setImportedCount(res.imported);
          setOriginalHeaders(res.headers.original);
          setPhase('done');
          pushToast({
            kind: 'success',
            message: `Connected! Imported ${res.imported} feature request${res.imported !== 1 ? 's' : ''}.`,
            durationMs: 4000,
          });
        },
        onError: (err) => {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to connect sheet');
          setPhase('error');
        },
      },
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Connect feature-request spreadsheet for ${brandName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[520px] mx-4 rounded-xl border border-border bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Connect spreadsheet</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {phase === 'input' && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-foreground">Spreadsheet URL</label>
                <input
                  ref={inputRef}
                  autoFocus
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidUrl) handleConnect();
                    if (e.key === 'Escape') onClose();
                  }}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
                {sheetUrl && !isValidUrl && (
                  <p className="text-xs text-red-400">Enter a valid spreadsheet URL</p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="standardize"
                  checked={standardize}
                  onChange={(e) => setStandardize(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <label htmlFor="standardize" className="text-xs text-foreground leading-relaxed">
                  <span className="font-medium">Standardize headers</span> — rewrite the
                  sheet&apos;s header row to &quot;Date, Request, Response, Resolved&quot; for
                  consistency. Existing data is preserved.
                </label>
              </div>

              <div className="rounded-lg bg-card/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground mb-1">How it works</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    Momentum reads the sheet and detects columns (Date, Request, Response, Resolved)
                  </li>
                  <li>All existing rows are imported as feature requests</li>
                  <li>Changes in Momentum sync back to the sheet, and vice versa</li>
                </ul>
              </div>
            </>
          )}

          {phase === 'connecting' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Reading sheet and importing data…</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 size={28} className="text-emerald-400" />
              <p className="text-sm text-foreground">Connected successfully!</p>
              <p className="text-xs text-muted-foreground">
                Imported {importedCount} feature request{importedCount !== 1 ? 's' : ''} from the
                sheet.
              </p>
              {originalHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Detected columns: {originalHeaders.join(', ')}
                </p>
              )}
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertTriangle size={28} className="text-amber-400" />
              <p className="text-sm text-foreground">Connection failed</p>
              <p className="text-xs text-muted-foreground text-center max-w-sm">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          {phase === 'input' && (
            <>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={!isValidUrl}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Connect &amp; Import
              </button>
            </>
          )}
          {phase === 'error' && (
            <>
              <button
                onClick={() => setPhase('input')}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-card text-foreground text-xs font-medium hover:bg-secondary transition"
              >
                Close
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
