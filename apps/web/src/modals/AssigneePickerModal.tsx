import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { UserSummary } from '@momentum/shared';
import { useUsers } from '../api/hooks';
import { Avatar } from '../components/Avatar';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (userId: string | null) => void;
  title?: string;
  /** When true, includes a "No assignee" option pinned at the bottom. */
  allowClear?: boolean;
  /** Highlight the currently-assigned user so a no-op press still closes the modal. */
  currentAssigneeId?: string | null;
}

/**
 * Keyboard-first picker for a single user. 1–9 number keys pick by index,
 * j/k or ↑↓ navigates, Enter confirms the highlighted row, Esc cancels.
 * The search field is always focused on open so typing narrows the list
 * immediately — matching the brand-search / role-picker UX pattern.
 *
 * Rendered via portal per the `feedback_modals_use_portals` memory so
 * nested layouts (e.g., brand detail view) don't clip the modal.
 */
export function AssigneePickerModal({
  open,
  onClose,
  onSelect,
  title = 'Assign to',
  allowClear = false,
  currentAssigneeId,
}: Props) {
  const usersQ = useUsers();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const allUsers: readonly UserSummary[] = usersQ.data ?? [];

  const filtered = useMemo(
    () => filterUsers(allUsers, query),
    [allUsers, query],
  );

  type Option =
    | { kind: 'user'; user: UserSummary }
    | { kind: 'clear'; user: null };

  const options = useMemo<Option[]>(() => {
    const base: Option[] = filtered.map((u) => ({ kind: 'user', user: u }));
    if (allowClear) base.push({ kind: 'clear', user: null });
    return base;
  }, [filtered, allowClear]);

  // Reset cursor + query whenever the modal opens or the roster shifts.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
  }, [open]);

  useEffect(() => {
    if (cursor >= options.length) setCursor(0);
  }, [options.length, cursor]);

  const commit = (value: Option) => {
    if (value.kind === 'clear') {
      onSelect(null);
    } else {
      onSelect(value.user.id);
    }
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
        setCursor((c) => (options.length === 0 ? 0 : (c + 1) % options.length));
        return;
      }
      if (e.key === 'ArrowUp' || (e.key === 'k' && !isTypingInSearch(e))) {
        e.preventDefault();
        e.stopPropagation();
        setCursor((c) => (options.length === 0 ? 0 : (c - 1 + options.length) % options.length));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const opt = options[cursor];
        if (opt) commit(opt);
        return;
      }
      if (/^[1-9]$/.test(e.key) && !isTypingInSearch(e)) {
        const idx = Number(e.key) - 1;
        const opt = options[idx];
        if (opt) {
          e.preventDefault();
          e.stopPropagation();
          commit(opt);
        }
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, cursor, options, onClose]);

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
      <div className="w-full max-w-sm rounded-xl border border-border bg-background shadow-2xl p-4 animate-scaleIn">
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {title}
          </div>
          <input
            data-assignee-search="true"
            type="text"
            placeholder="Search team…"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            className="mt-2 w-full bg-transparent text-sm px-0 py-1 border-b border-border/60 focus:outline-none focus:border-primary"
          />
        </div>

        {usersQ.isLoading ? (
          <p className="text-sm text-muted-foreground px-1 py-2">Loading team…</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-2">
            {query ? 'No matches.' : 'No active team members.'}
          </p>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {options.map((opt, i) => {
              const isCurrent =
                opt.kind === 'user'
                  ? opt.user.id === currentAssigneeId
                  : currentAssigneeId === null;
              return (
                <li
                  key={opt.kind === 'user' ? opt.user.id : 'clear'}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(opt)}
                  className={clsx(
                    'flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm cursor-pointer transition',
                    cursor === i ? 'bg-card text-foreground' : 'text-muted-foreground hover:bg-card/60',
                  )}
                >
                  {opt.kind === 'user' ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <Avatar user={opt.user} size="sm" showTooltip={false} />
                      <span className="truncate">{opt.user.displayName || opt.user.email}</span>
                      {isCurrent && (
                        <span className="text-[9px] text-muted-foreground/70">· current</span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="inline-block w-5 h-5 rounded-full border border-border" />
                      No assignee
                    </span>
                  )}
                  {i < 9 && (
                    <span className="text-[10px] text-muted-foreground/70 font-mono">{i + 1}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 pt-3 border-t border-border/60 text-[10px] text-muted-foreground/70 flex items-center justify-between">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> nav · <Kbd>Enter</Kbd> pick
          </span>
          <span>
            <Kbd>1</Kbd>–<Kbd>9</Kbd> jump · <Kbd>Esc</Kbd> cancel
          </span>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return body;
  return createPortal(body, document.body);
}

function isTypingInSearch(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return t?.dataset?.assigneeSearch === 'true';
}

function filterUsers(users: readonly UserSummary[], query: string): UserSummary[] {
  if (!query.trim()) return [...users];
  const q = query.toLowerCase().trim();
  return users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q),
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.2rem] h-4 px-1 rounded border border-border bg-card text-[9px] font-mono text-muted-foreground">
      {children}
    </kbd>
  );
}
