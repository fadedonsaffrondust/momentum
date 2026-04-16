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
  | 'release-notes';

export type ToastKind = 'info' | 'success' | 'error';

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

  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  focusedColumn: 'up_next' | 'in_progress' | 'done';
  setFocusedColumn: (c: UiState['focusedColumn']) => void;

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

  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  focusedColumn: 'up_next',
  setFocusedColumn: (c) => set({ focusedColumn: c }),

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
