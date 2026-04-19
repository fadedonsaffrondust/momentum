import { useRef, useState, useEffect } from 'react';
import type { Brand, BrandMeeting, BrandActionItem } from '@momentum/shared';
import { RefreshCw } from 'lucide-react';
import { HealthPill } from './HealthPill';
import { computeBrandHealth } from '../../hooks/useBrandHealth';
import { useUpdateBrand, useDeleteBrand } from '../../api/hooks';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../../store/ui';
import { confirm } from '../ConfirmModal';

interface Props {
  brand: Brand;
  meetings: BrandMeeting[];
  actionItems: BrandActionItem[];
  onNewMeeting: () => void;
  onSyncRecordings: () => void;
  onSyncSettings: () => void;
}

export function BrandDetailHeader({
  brand,
  meetings,
  actionItems,
  onNewMeeting,
  onSyncRecordings,
  onSyncSettings,
}: Props) {
  const health = computeBrandHealth(meetings, actionItems);
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setName(brand.name);
  }, [brand.name]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitName = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== brand.name) {
      updateBrand.mutate({ id: brand.id, name: trimmed });
    } else {
      setName(brand.name);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm(`Delete "${brand.name}" and all its data?`))) return;
    deleteBrand.mutate(brand.id, {
      onSuccess: () => {
        navigate('/brands');
        pushToast({ kind: 'info', message: `Deleted "${brand.name}"`, durationMs: 3000 });
      },
    });
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-4 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <HealthPill status={health} showLabel />
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setName(brand.name);
                setEditing(false);
              }
            }}
            className="text-xl font-semibold text-foreground bg-transparent border-b border-primary focus:outline-none min-w-0"
          />
        ) : (
          <h1
            className="text-xl font-semibold text-foreground truncate cursor-pointer hover:text-primary transition"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {brand.name}
          </h1>
        )}
        {brand.status === 'importing' && (
          <span className="text-xs text-primary animate-pulse px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5">
            Importing…
          </span>
        )}
        {brand.status === 'import_failed' && (
          <span className="text-xs text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/5">
            Import failed
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onNewMeeting}
          className="px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-sm transition"
        >
          + New Meeting Note
        </button>

        <button
          onClick={onSyncRecordings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition"
          title="Sync meeting recordings"
        >
          <RefreshCw size={14} />
          Sync Recordings
        </button>

        <button
          onClick={onSyncSettings}
          className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
          aria-label="Recording sync settings"
          title="Recording sync settings"
        >
          ⚙
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            aria-label="More actions"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-30 w-40 rounded-lg border border-border bg-background shadow-xl py-1 animate-scaleIn">
                <button
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-secondary"
                >
                  Rename
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-secondary"
                >
                  Delete brand
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
