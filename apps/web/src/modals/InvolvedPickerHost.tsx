import { useUiStore } from '../store/ui';
import { useUpdateParking } from '../api/hooks';
import { InvolvedUsersPickerModal } from './InvolvedUsersPickerModal';

/**
 * Global host for the involved-users picker. Opened via the `I`
 * shortcut on the parkings page or by clicking the involved stack.
 * Mounted once in `AppShell` so the picker can be driven from anywhere.
 */
export function InvolvedPickerHost() {
  const target = useUiStore((s) => s.involvedPickerTarget);
  const close = useUiStore((s) => s.closeInvolvedPicker);
  const pushToast = useUiStore((s) => s.pushToast);
  const updateParking = useUpdateParking();

  if (!target) return null;

  const handleConfirm = (userIds: string[]) => {
    updateParking.mutate(
      { id: target.parkingId, involvedIds: userIds },
      {
        onError: (err) => {
          pushToast({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Failed to update involved users',
            durationMs: 4000,
          });
        },
      },
    );
  };

  return (
    <InvolvedUsersPickerModal
      open={true}
      onClose={close}
      onConfirm={handleConfirm}
      initialIds={target.initialIds}
      excludeId={target.creatorId}
      title="Involve teammates"
    />
  );
}
