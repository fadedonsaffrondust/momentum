import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { UserSummary } from '@momentum/shared';
import { useUsers } from '../api/hooks';
import { Avatar } from '../components/Avatar';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Currently-involved user ids. The modal stages edits locally and only
   *  commits via `onConfirm` when the user presses Enter/Save. */
  initialIds: readonly string[];
  onConfirm: (userIds: string[]) => void;
  title?: string;
  /** Optional id to hide (typically the creator) so they can't add themselves. */
  excludeId?: string;
}

/**
 * Multi-select variant of the assignee picker used for parking
 * `involvedIds[]` (spec §9.5, triggered via the `I` shortcut). Space
 * toggles the focused row; Enter commits the entire selection; Esc
 * cancels without saving. Numbers 1–9 toggle the matching row.
 *
 * Uses a staged selection (`selected`) so the user can preview their
 * changes before committing — the backend only sees the final list.
 */
export function InvolvedUsersPickerModal({
  open,
  onClose,
  initialIds,
  onConfirm,
  title = 'Involve teammates',
  excludeId,
}: Props) {
  const usersQ = useUsers();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    setSelected(new Set(initialIds));
  }, [open, initialIds]);

  const allUsers: readonly UserSummary[] = usersQ.data ?? [];

  const filtered = useMemo(() => {
    const base = excludeId
      ? allUsers.filter((u) => u.id !== excludeId)
      : [...allUsers];
    if (!query.trim()) return base;
    const q = query.toLowerCase().trim();
    return base.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [allUsers, query, excludeId]);

  useEffect(() => {
    if (cursor >= filtered.length) setCursor(0);
  }, [filtered.length, cursor]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const commit = () => {
    onConfirm([...selected]);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || (e.key === 'j' && !isTypingInSearch(e))) {
        e.preventDefault();
        e.stopPropagation();
        setCursor((c) => (filtered.length === 0 ? 0 : (c + 1) % filtered.length));
        return;
      }
      if (e.key === 'ArrowUp' || (e.key === 'k' && !isTypingInSearch(e))) {
        e.preventDefault();
        e.stopPropagation();
        setCursor((c) => (filtered.length === 0 ? 0 : (c - 1 + filtered.length) % filtered.length));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commit();
        return;
      }
      if (e.key === ' ' && !isTypingInSearch(e)) {
        e.preventDefault();
        e.stopPropagation();
        const u = filtered[cursor];
        if (u) toggle(u.id);
        return;
      }
      if (/^[1-9]$/.test(e.key) && !isTypingInSearch(e)) {
        const idx = Number(e.key) - 1;
        const u = filtered[idx];
        if (u) {
          e.preventDefault();
          e.stopPropagation();
          toggle(u.id);
        }
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, cursor, filtered, onClose, selected]);

  if (!open) return null;

  const body = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-m-border bg-m-bg shadow-2xl p-4 animate-scaleIn">
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-widest text-m-fg-muted">
            {title}
          </div>
          <input
            data-involved-search="true"
            type="text"
            placeholder="Search team…"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            className="mt-2 w-full bg-transparent text-sm px-0 py-1 border-b border-m-border-subtle focus:outline-none focus:border-accent"
          />
          <div className="mt-2 text-[10px] text-m-fg-dim">
            {selected.size} selected
          </div>
        </div>

        {usersQ.isLoading ? (
          <p className="text-sm text-m-fg-muted px-1 py-2">Loading team…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-m-fg-muted px-1 py-2">
            {query ? 'No matches.' : 'No teammates to add.'}
          </p>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {filtered.map((u, i) => {
              const isSelected = selected.has(u.id);
              return (
                <li
                  key={u.id}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => toggle(u.id)}
                  className={clsx(
                    'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm cursor-pointer transition',
                    cursor === i ? 'bg-m-surface text-m-fg' : 'text-m-fg-tertiary hover:bg-m-surface-60',
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Checkbox checked={isSelected} />
                    <Avatar user={u} size="sm" showTooltip={false} />
                    <span className="truncate">{u.displayName || u.email}</span>
                  </span>
                  {i < 9 && (
                    <span className="text-[10px] text-m-fg-dim font-mono">{i + 1}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 pt-3 border-t border-m-border-subtle text-[10px] text-m-fg-dim flex items-center justify-between">
          <span>
            <Kbd>Space</Kbd> toggle · <Kbd>1</Kbd>–<Kbd>9</Kbd> jump
          </span>
          <span>
            <Kbd>Enter</Kbd> save · <Kbd>Esc</Kbd> cancel
          </span>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return body;
  return createPortal(body, document.body);
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'inline-flex items-center justify-center w-3.5 h-3.5 rounded border',
        checked
          ? 'bg-accent border-accent text-white'
          : 'border-m-border-strong',
      )}
    >
      {checked && <span className="text-[8px] leading-none">✓</span>}
    </span>
  );
}

function isTypingInSearch(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return t?.dataset?.involvedSearch === 'true';
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.2rem] h-4 px-1 rounded border border-m-border bg-m-surface text-[9px] font-mono text-m-fg-tertiary">
      {children}
    </kbd>
  );
}
