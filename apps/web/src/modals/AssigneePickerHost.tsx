import { useUiStore } from '../store/ui';
import { useSendActionItemToToday, useUpdateBrandActionItem, useUpdateTask } from '../api/hooks';
import { AssigneePickerModal } from './AssigneePickerModal';

/**
 * Thin host for the global assignee picker. The `A` keyboard shortcut,
 * action-item avatar click, and send-to-today button all dispatch
 * `openAssigneePicker(target)` against the UI store; this component
 * subscribes and routes the `onSelect` to the right mutation based on
 * the target's `kind`.
 *
 * Mounted once at `AppShell` so the picker works from any page.
 */
export function AssigneePickerHost() {
  const target = useUiStore((s) => s.assigneePickerTarget);
  const close = useUiStore((s) => s.closeAssigneePicker);
  const pushToast = useUiStore((s) => s.pushToast);

  const updateTask = useUpdateTask();
  // Hooks take brandId at call time — pass empty string when the target
  // isn't a brand entity. The mutation never fires in that case.
  const updateActionItem = useUpdateBrandActionItem(
    target?.kind === 'action-item' ? target.brandId : '',
  );
  const sendToToday = useSendActionItemToToday(
    target?.kind === 'send-to-today' ? target.brandId : '',
  );

  if (!target) return null;

  const handleSelect = (userId: string | null) => {
    if (target.kind === 'task') {
      if (!userId) return; // tasks require a non-null assignee
      updateTask.mutate(
        { id: target.taskId, assigneeId: userId },
        {
          onError: (err) => {
            pushToast({
              kind: 'error',
              message: err instanceof Error ? err.message : 'Failed to reassign',
              durationMs: 4000,
            });
          },
        },
      );
      return;
    }
    if (target.kind === 'action-item') {
      updateActionItem.mutate(
        { id: target.itemId, assigneeId: userId },
        {
          onError: (err) => {
            pushToast({
              kind: 'error',
              message: err instanceof Error ? err.message : 'Failed to reassign',
              durationMs: 4000,
            });
          },
        },
      );
      return;
    }
    // send-to-today — backend requires a non-null assigneeId (Task 8).
    if (!userId) return;
    sendToToday.mutate(
      { id: target.itemId, assigneeId: userId },
      {
        onSuccess: (res) => {
          pushToast({
            kind: 'success',
            message: `Sent to Today: "${res.task.title}"`,
            durationMs: 3000,
          });
        },
        onError: (err) => {
          pushToast({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Failed to send to Today',
            durationMs: 4000,
          });
        },
      },
    );
  };

  const title =
    target.kind === 'send-to-today'
      ? 'Send to whose Today?'
      : target.kind === 'task'
        ? 'Assign task'
        : 'Assign action item';

  const currentAssigneeId =
    target.kind === 'send-to-today'
      ? undefined
      : target.kind === 'task'
        ? target.currentAssigneeId
        : target.currentAssigneeId;

  return (
    <AssigneePickerModal
      open={true}
      onClose={close}
      onSelect={handleSelect}
      title={title}
      allowClear={target.kind === 'action-item'}
      {...(currentAssigneeId !== undefined ? { currentAssigneeId } : {})}
    />
  );
}
