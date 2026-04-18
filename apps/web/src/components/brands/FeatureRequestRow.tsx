import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { BrandFeatureRequest } from '@momentum/shared';
import { Pencil, Trash2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  fr: BrandFeatureRequest;
  rowIndex: number;
  isFocused: boolean;
  onUpdate: (fields: { date?: string; request?: string; response?: string | null; resolved?: boolean }) => void;
  onDelete: () => void;
  onConvert: () => void;
  isPending: boolean;
}

function formatDate(raw: string): string {
  const parts = raw.split('/');
  if (parts.length !== 3) return raw;
  const d = new Date(parseInt(parts[0]!), parseInt(parts[1]!) - 1, parseInt(parts[2]!));
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type EditingField = 'date' | 'request' | 'response' | null;

export function FeatureRequestRow({ fr, rowIndex, isFocused, onUpdate, onDelete, onConvert, isPending }: Props) {
  const [editing, setEditing] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = (field: EditingField) => {
    if (!field) return;
    setEditing(field);
    if (field === 'date') setEditValue(fr.date);
    else if (field === 'request') setEditValue(fr.request);
    else if (field === 'response') setEditValue(fr.response ?? '');
  };

  const commitEdit = () => {
    if (!editing) return;
    const trimmed = editValue.trim();
    if (editing === 'date' && trimmed && trimmed !== fr.date) {
      onUpdate({ date: trimmed });
    } else if (editing === 'request' && trimmed && trimmed !== fr.request) {
      onUpdate({ request: trimmed });
    } else if (editing === 'response') {
      const newVal = trimmed || null;
      if (newVal !== (fr.response ?? null)) {
        onUpdate({ response: newVal });
      }
    }
    setEditing(null);
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editing !== 'response') commitEdit();
    if (e.key === 'Enter' && editing === 'response' && !e.shiftKey) commitEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const toggleResolved = () => {
    onUpdate({ resolved: !fr.resolved });
  };

  return (
    <div
      className={clsx(
        'group grid gap-x-3 border-b border-border/60 px-3 py-2 transition',
        rowIndex % 2 === 1 && 'bg-card/30',
        fr.resolved && 'opacity-50',
        isFocused && 'ring-1 ring-inset ring-primary/40 bg-primary/5',
      )}
      style={{ gridTemplateColumns: '70px 1fr 1fr 32px 52px' }}
    >
      {/* Date */}
      <div
        className="text-2xs font-mono text-muted-foreground whitespace-nowrap pt-0.5 cursor-pointer"
        onDoubleClick={() => startEdit('date')}
      >
        {editing === 'date' ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-background border border-primary/50 rounded px-1.5 py-0.5 text-2xs font-mono focus:outline-none"
          />
        ) : (
          formatDate(fr.date)
        )}
      </div>

      {/* Request */}
      <div
        className="min-w-0 cursor-pointer"
        onDoubleClick={() => startEdit('request')}
      >
        {editing === 'request' ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-background border border-primary/50 rounded px-2 py-0.5 text-xs focus:outline-none"
          />
        ) : (
          <p className={clsx(
            'text-xs leading-relaxed text-foreground',
            fr.resolved && 'line-through',
          )}>
            {fr.request}
          </p>
        )}
      </div>

      {/* Response */}
      <div
        className="min-w-0 cursor-pointer"
        onDoubleClick={() => startEdit('response')}
      >
        {editing === 'response' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full bg-background border border-primary/50 rounded px-2 py-0.5 text-xs focus:outline-none resize-none"
          />
        ) : fr.response ? (
          <p className="text-xs leading-relaxed text-foreground">{fr.response}</p>
        ) : (
          <span className="text-muted-foreground italic text-2xs">—</span>
        )}
      </div>

      {/* Resolved */}
      <div className="flex items-start justify-center pt-0.5">
        <button
          onClick={toggleResolved}
          className={clsx(
            'inline-flex items-center justify-center w-3.5 h-3.5 rounded border-[1.5px] transition',
            fr.resolved
              ? 'bg-primary border-primary text-white'
              : 'border-border bg-transparent hover:border-primary/50',
          )}
          aria-label={fr.resolved ? 'Mark unresolved' : 'Mark resolved'}
        >
          {fr.resolved && <span className="text-[8px]">✓</span>}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-start gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 transition">
        {isPending ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : fr.syncStatus === 'error' ? (
          <span title="Sync failed"><AlertTriangle size={12} className="text-amber-400" /></span>
        ) : (
          <>
            {!fr.resolved && (
              <button
                onClick={onConvert}
                className="p-0.5 text-muted-foreground/70 hover:text-primary"
                title="Create Action Item"
              >
                <ArrowRight size={12} />
              </button>
            )}
            <button
              onClick={() => startEdit('request')}
              className="p-0.5 text-muted-foreground/70 hover:text-foreground"
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onDelete}
              className="p-0.5 text-muted-foreground/70 hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
