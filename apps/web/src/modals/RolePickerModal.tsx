import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useLocation } from 'react-router-dom';
import { useUiStore } from '../store/ui';
import { useParkings, useRoles, useTasks, useUpdateParking, useUpdateTask } from '../api/hooks';
import { todayIso } from '../lib/date';

export function RolePickerModal() {
  const close = useUiStore((s) => s.closeModal);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const selectedParkingId = useUiStore((s) => s.selectedParkingId);
  const pushToast = useUiStore((s) => s.pushToast);
  const location = useLocation();
  const isParkingsView = location.pathname === '/parkings';

  const rolesQ = useRoles();
  const tasksQ = useTasks({ date: todayIso() });
  const parkingsQ = useParkings();
  const updateTask = useUpdateTask();
  const updateParking = useUpdateParking();

  const task = isParkingsView
    ? undefined
    : (tasksQ.data ?? []).find((t) => t.id === selectedTaskId);
  const parking = isParkingsView
    ? (parkingsQ.data ?? []).find((p) => p.id === selectedParkingId)
    : undefined;
  const subject = task ?? parking;
  const currentRoleId = task?.roleId ?? parking?.roleId ?? null;
  const subjectTitle = task?.title ?? parking?.title ?? '';

  const roles = rolesQ.data ?? [];

  const options: { id: string | null; name: string; color: string | null }[] = [
    ...roles.map((r) => ({ id: r.id, name: r.name, color: r.color })),
    { id: null, name: 'No role', color: null },
  ];

  const startIdx = options.findIndex((o) => o.id === currentRoleId);
  const [cursor, setCursor] = useState(Math.max(0, startIdx));

  useEffect(() => {
    const apply = async (roleId: string | null) => {
      if (!subject) return;
      try {
        if (task) {
          await updateTask.mutateAsync({ id: task.id, roleId });
        } else if (parking) {
          await updateParking.mutateAsync({ id: parking.id, roleId });
        }
        pushToast({
          kind: 'success',
          message: `Role set to ${options.find((o) => o.id === roleId)?.name ?? 'none'}`,
          durationMs: 2500,
        });
        close();
      } catch (err) {
        pushToast({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to update role',
          durationMs: 4000,
        });
      }
    };

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setCursor((c) => (c + 1) % options.length);
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setCursor((c) => (c - 1 + options.length) % options.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const opt = options[cursor];
        if (opt) void apply(opt.id);
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const role = roles[idx];
        if (role) {
          e.preventDefault();
          e.stopPropagation();
          void apply(role.id);
        }
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        e.stopPropagation();
        void apply(null);
        return;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [close, cursor, options, pushToast, roles, task, parking, subject, updateTask, updateParking]);

  if (!subject) {
    return (
      <Overlay onClose={close}>
        <p className="text-sm text-muted-foreground">Nothing selected.</p>
      </Overlay>
    );
  }

  const directApply = (roleId: string | null) => {
    if (task) updateTask.mutate({ id: task.id, roleId });
    else if (parking) updateParking.mutate({ id: parking.id, roleId });
    close();
  };

  return (
    <Overlay onClose={close}>
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Assign role
        </div>
        <div className="text-sm text-foreground mt-0.5 truncate">{subjectTitle}</div>
      </div>
      <ul className="space-y-1">
        {options.map((o, i) => (
          <li
            key={o.id ?? 'none'}
            onMouseEnter={() => setCursor(i)}
            onClick={() => directApply(o.id)}
            className={clsx(
              'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm cursor-pointer transition',
              cursor === i ? 'bg-card text-foreground' : 'text-muted-foreground hover:bg-card/60',
            )}
          >
            <span className="flex items-center gap-2">
              {o.color ? (
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: o.color }}
                />
              ) : (
                <span className="inline-block w-2 h-2 rounded-full border border-border" />
              )}
              {o.name}
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-mono">
              {o.id === null ? '0' : i < 9 ? i + 1 : ''}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-3 border-t border-border/60 text-[10px] text-muted-foreground/70 flex items-center justify-between">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate &nbsp; <Kbd>Enter</Kbd> select
        </span>
        <span>
          <Kbd>1</Kbd>–<Kbd>9</Kbd> pick &nbsp; <Kbd>Esc</Kbd> cancel
        </span>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Pick role"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-background shadow-2xl p-4 animate-scaleIn">
        {children}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.2rem] h-4 px-1 rounded border border-border bg-card text-[9px] font-mono text-muted-foreground">
      {children}
    </kbd>
  );
}
