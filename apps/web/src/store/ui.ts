import { create } from 'zustand';
import type { ExportFile } from '@momentum/shared';

export type ModalKind =
  | null
  | 'command-palette'
  | 'plan-my-day'
  | 'end-of-day'
  | 'weekly-stats'
  | 'shortcuts'
  | 'import-confirm'
  | 'role-picker'
  | 'release-notes'
  | 'settings';

export type ToastKind = 'info' | 'success' | 'error';

/**
 * Context for an open assignee picker. The picker itself is rendered
 * at the layout level (AppShell) so any page can trigger it via
 * `openAssigneePicker({kind, ...})` from a keyboard handler or click.
 */
export type AssigneePickerTarget =
  | { kind: 'task'; taskId: string; currentAssigneeId: string }
  | { kind: 'action-item'; brandId: string; itemId: string; currentAssigneeId: string | null }
  | { kind: 'send-to-today'; brandId: string; itemId: string; itemText: string };

export interface InvolvedPickerTarget {
  parkingId: string;
  initialIds: readonly string[];
  /** The creator is excluded from the picker — they implicitly own the
   *  parking already; "involving them" is meaningless. */
  creatorId: string;
}

export type TaskAssigneeFilter = 'mine' | 'everyone';

/** Parkings view filter (spec §9.5). All = team + caller's private. */
export type ParkingScopeFilter = 'mine' | 'involving' | 'all';

/** Inbox filter (spec §9.8). Default is unread-only. */
export type InboxFilter = 'unread' | 'all';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
}

interface UiState {
  activeModal: ModalKind;
  openModal: (m: ModalKind) => void;
  closeModal: () => void;

  roleFilter: string | null; // null = all
  setRoleFilter: (id: string | null) => void;

  /**
   * Mine (default) scopes to the current user's tasks; Everyone asks
   * the backend for the full team roster via `assigneeId=ALL`.
   * Persisted across views so navigating Today → Backlog feels stable.
   */
  taskAssigneeFilter: TaskAssigneeFilter;
  setTaskAssigneeFilter: (f: TaskAssigneeFilter) => void;

  parkingScopeFilter: ParkingScopeFilter;
  setParkingScopeFilter: (f: ParkingScopeFilter) => void;

  inboxFilter: InboxFilter;
  setInboxFilter: (f: InboxFilter) => void;

  selectedInboxEventId: string | null;
  setSelectedInboxEventId: (id: string | null) => void;

  assigneePickerTarget: AssigneePickerTarget | null;
  openAssigneePicker: (target: AssigneePickerTarget) => void;
  closeAssigneePicker: () => void;

  involvedPickerTarget: InvolvedPickerTarget | null;
  openInvolvedPicker: (target: InvolvedPickerTarget) => void;
  closeInvolvedPicker: () => void;

  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  focusedColumn: 'up_next' | 'in_progress' | 'done';
  setFocusedColumn: (c: UiState['focusedColumn']) => void;

  /**
   * When non-null, `TaskDetailModal` is open with this task id.
   * Opened by Enter on /team (spec §9.7) and the Team Task View row
   * click. Closed by Esc or outside click.
   */
  selectedDetailTaskId: string | null;
  setSelectedDetailTaskId: (id: string | null) => void;

  selectedParkingId: string | null;
  setSelectedParkingId: (id: string | null) => void;

  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;

  pendingImport: ExportFile | null;
  setPendingImport: (file: ExportFile | null) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  activeModal: null,
  openModal: (m) => set({ activeModal: m }),
  closeModal: () => set({ activeModal: null }),

  roleFilter: null,
  setRoleFilter: (id) => set({ roleFilter: id }),

  taskAssigneeFilter: 'mine',
  setTaskAssigneeFilter: (f) => set({ taskAssigneeFilter: f }),

  parkingScopeFilter: 'all',
  setParkingScopeFilter: (f) => set({ parkingScopeFilter: f }),

  inboxFilter: 'unread',
  setInboxFilter: (f) => set({ inboxFilter: f }),

  selectedInboxEventId: null,
  setSelectedInboxEventId: (id) => set({ selectedInboxEventId: id }),

  assigneePickerTarget: null,
  openAssigneePicker: (target) => set({ assigneePickerTarget: target }),
  closeAssigneePicker: () => set({ assigneePickerTarget: null }),

  involvedPickerTarget: null,
  openInvolvedPicker: (target) => set({ involvedPickerTarget: target }),
  closeInvolvedPicker: () => set({ involvedPickerTarget: null }),

  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  focusedColumn: 'up_next',
  setFocusedColumn: (c) => set({ focusedColumn: c }),

  selectedDetailTaskId: null,
  setSelectedDetailTaskId: (id) => set({ selectedDetailTaskId: id }),

  selectedParkingId: null,
  setSelectedParkingId: (id) => set({ selectedParkingId: id }),

  toasts: [],
  pushToast: (t) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    window.setTimeout(() => get().dismissToast(id), t.durationMs);
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  pendingImport: null,
  setPendingImport: (file) => set({ pendingImport: file }),
}));
