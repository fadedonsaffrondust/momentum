import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { Parking, Priority } from '@momentum/shared';
import {
  useCreateParking,
  useDeleteParking,
  useDiscussParking,
  useUpdateParking,
} from '../../api/hooks';
import { useUiStore } from '../../store/ui';
import { shouldBailOnEvent, useKeyboardBailFlags } from './_shared';

const PRIORITY_CYCLE: readonly Priority[] = ['low', 'medium', 'high'] as const;
const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

interface ParkingsPageCtx {
  parkings: Parking[];
  /** Tells the page to switch a row into inline-edit mode (`e`). */
  setEditingParkingId: (id: string | null) => void;
  /** Tells the page to expand/collapse the inline detail panel (`Enter`). */
  onParkingToggleExpand: (id: string) => void;
}

/**
 * Parkings-view (`/parkings`) keyboard shortcuts:
 *   j / k / ↓ / ↑   — move selection
 *   Enter           — toggle detail expand
 *   Space           — mark discussed (no-op if already discussed)
 *   e               — inline-edit
 *   r               — open role picker
 *   p               — cycle priority
 *   d               — defer one day
 *   v               — toggle visibility (private ↔ team)
 *   I (Shift+I)     — open involved-users picker
 *   Delete / Backsp — delete with undo
 *
 * Bindings ported VERBATIM from the original useKeyboardController so a
 * future cross-check against ShortcutsModal still passes.
 */
export function useParkingsPageKeys(ctx: ParkingsPageCtx) {
  const location = useLocation();
  const flags = useKeyboardBailFlags();
  const openModal = useUiStore((s) => s.openModal);
  const openInvolvedPicker = useUiStore((s) => s.openInvolvedPicker);
  const selectedParkingId = useUiStore((s) => s.selectedParkingId);
  const setSelectedParkingId = useUiStore((s) => s.setSelectedParkingId);
  const pushToast = useUiStore((s) => s.pushToast);

  const discussParking = useDiscussParking();
  const deleteParking = useDeleteParking();
  const updateParking = useUpdateParking();
  const createParking = useCreateParking();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (shouldBailOnEvent(e, flags)) return;
      if (location.pathname !== '/parkings') return;

      const parkings = ctx.parkings;
      if (parkings.length === 0) return;

      const currentParkingIdx = parkings.findIndex((p) => p.id === selectedParkingId);

      const moveParking = (delta: number) => {
        const base = currentParkingIdx < 0 ? (delta > 0 ? -1 : parkings.length) : currentParkingIdx;
        const next = Math.max(0, Math.min(parkings.length - 1, base + delta));
        const nextP = parkings[next];
        if (nextP) setSelectedParkingId(nextP.id);
      };

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveParking(1);
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveParking(-1);
        return;
      }

      const selectedP = parkings.find((p) => p.id === selectedParkingId);
      if (!selectedP) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        ctx.onParkingToggleExpand(selectedP.id);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (selectedP.status !== 'discussed') {
          discussParking.mutate(selectedP.id);
        }
        return;
      }
      if (e.key === 'e') {
        e.preventDefault();
        ctx.setEditingParkingId(selectedP.id);
        return;
      }
      if (e.key === 'r') {
        e.preventDefault();
        openModal('role-picker');
        return;
      }
      if (e.key === 'p') {
        e.preventDefault();
        const currentIdx = PRIORITY_CYCLE.indexOf(selectedP.priority);
        const next = PRIORITY_CYCLE[(currentIdx + 1) % PRIORITY_CYCLE.length] ?? 'medium';
        updateParking.mutate(
          { id: selectedP.id, priority: next },
          {
            onSuccess: () => {
              pushToast({
                kind: 'info',
                message: `Priority → ${PRIORITY_LABEL[next]}`,
                durationMs: 2000,
              });
            },
            onError: (err) => {
              pushToast({
                kind: 'error',
                message: err instanceof Error ? err.message : 'Failed to update priority',
                durationMs: 4000,
              });
            },
          },
        );
        return;
      }
      if (e.key === 'd') {
        e.preventDefault();
        const base = selectedP.targetDate
          ? new Date(selectedP.targetDate + 'T00:00:00')
          : new Date();
        base.setDate(base.getDate() + 1);
        const nextDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
        updateParking.mutate(
          { id: selectedP.id, targetDate: nextDate },
          {
            onSuccess: () => {
              pushToast({
                kind: 'info',
                message: `Deferred to ${nextDate}`,
                durationMs: 2000,
              });
            },
          },
        );
        return;
      }
      if (e.key === 'v') {
        // Toggle visibility. Backend restricts PATCH on private parkings
        // to the creator; if another user tries this they get 404 and
        // we surface a toast. The optimistic path avoids a round-trip.
        e.preventDefault();
        const nextVisibility = selectedP.visibility === 'private' ? 'team' : 'private';
        updateParking.mutate(
          { id: selectedP.id, visibility: nextVisibility },
          {
            onSuccess: () => {
              pushToast({
                kind: 'info',
                message: `Visibility → ${nextVisibility === 'private' ? 'Private' : 'Team'}`,
                durationMs: 2000,
              });
            },
            onError: (err) => {
              pushToast({
                kind: 'error',
                message: err instanceof Error ? err.message : 'Failed to change visibility',
                durationMs: 4000,
              });
            },
          },
        );
        return;
      }
      if (e.key === 'I') {
        // Shift+I opens the involved-users picker. Lowercase i stays
        // free for future use and avoids firing while typing.
        e.preventDefault();
        openInvolvedPicker({
          parkingId: selectedP.id,
          initialIds: selectedP.involvedIds,
          creatorId: selectedP.creatorId,
        });
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const snapshot = selectedP;
        deleteParking.mutate(selectedP.id, {
          onSuccess: () => {
            pushToast({
              kind: 'info',
              message: `Deleted "${snapshot.title}"`,
              actionLabel: 'Undo',
              durationMs: 5000,
              onAction: () => {
                createParking.mutate({
                  title: snapshot.title,
                  notes: snapshot.notes,
                  outcome: snapshot.outcome,
                  roleId: snapshot.roleId,
                  priority: snapshot.priority,
                  targetDate: snapshot.targetDate,
                });
              },
            });
          },
        });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    ctx,
    flags,
    location.pathname,
    openModal,
    openInvolvedPicker,
    selectedParkingId,
    setSelectedParkingId,
    pushToast,
    discussParking,
    deleteParking,
    updateParking,
    createParking,
  ]);
}
