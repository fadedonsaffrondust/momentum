import { useRef, useState } from 'react';
import { useImportBrand } from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { X, Upload, FileText } from 'lucide-react';

interface Props {
  onClose: () => void;
  onImportStarted: (brandId: string) => void;
}

const MAX_SIZE_CHARS = 100_000;

export function ImportBrandModal({ onClose, onImportStarted }: Props) {
  const importBrand = useImportBrand();
  const pushToast = useUiStore((s) => s.pushToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);

    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      setError('Only .md and .txt files are supported in V1.');
      return;
    }

    try {
      const text = await file.text();
      if (!text.trim()) {
        setError('File is empty.');
        return;
      }
      setFileName(file.name);
      setFileContent(text);
    } catch {
      setError('Could not read file.');
    }
  };

  const handleAnalyze = async () => {
    if (!fileName || !fileContent) return;

    try {
      const res = await importBrand.mutateAsync({ fileName, fileContent });
      pushToast({
        kind: 'info',
        message: `Importing "${fileName}"… you can keep working.`,
        durationMs: 5000,
      });
      onImportStarted(res.brand.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const truncated = fileContent && fileContent.length > MAX_SIZE_CHARS;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-scaleIn overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
          <h2 className="text-sm text-zinc-300">Import Brand from File</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-6 space-y-5">
          <p className="text-xs text-zinc-500">
            Upload a <code className="text-zinc-400">.md</code> or{' '}
            <code className="text-zinc-400">.txt</code> file with client notes. The server
            will analyze it with AI and create a structured brand with meetings,
            stakeholders, and action items.
          </p>

          {/* File picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-8 text-center cursor-pointer transition"
          >
            {fileName ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={20} className="text-accent" />
                <div className="text-left">
                  <div className="text-sm text-zinc-200">{fileName}</div>
                  <div className="text-[10px] text-zinc-500">
                    {fileContent ? `${(fileContent.length / 1000).toFixed(1)}k characters` : ''}
                    {truncated && (
                      <span className="text-amber-400 ml-2">
                        Truncated to {MAX_SIZE_CHARS / 1000}k — oldest content may be lost
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload size={24} className="mx-auto text-zinc-600" />
                <p className="text-xs text-zinc-500">
                  Click to select a file
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-zinc-600">
              Requires <code className="text-zinc-500">OPENAI_API_KEY</code> on the server.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-zinc-800 text-sm hover:bg-zinc-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAnalyze()}
                disabled={!fileContent || importBrand.isPending}
                className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-sm transition disabled:opacity-50"
              >
                {importBrand.isPending ? 'Sending…' : 'Analyze'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
