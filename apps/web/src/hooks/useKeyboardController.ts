import type { Parking, Task } from '@momentum/shared';
import { useTodayPageKeys } from './keyboard/useTodayPageKeys';
import { useParkingsPageKeys } from './keyboard/useParkingsPageKeys';

interface KeyboardContext {
  tasks: Task[];
  /** Inline-edit state for parkings. Task edits use the detail drawer via `e`. */
  editingTaskId?: string | null;
  setEditingTaskId?: (id: string | null) => void;
  /** Flat list of parkings in rendered order (used on /parkings). */
  parkings?: Parking[];
  /** Invoked when Enter is pressed on a parking — toggles the details drawer. */
  onParkingToggleExpand?: (id: string) => void;
}

/**
 * Page-scoped keyboard composer. Each sub-hook is route-aware (bails on
 * the wrong pathname) so it's safe to call them all from anywhere — they
 * coexist without conflict and consumers don't need to know which is
 * which.
 *
 * Global shortcuts (/, Escape, ?, Cmd+K/P/R/W/E/I, g-prefix, [, ], 0-9)
 * live in `useGlobalShortcuts` and are registered once in `AppShell` —
 * do NOT handle them here.
 */
export function useKeyboardController(ctx: KeyboardContext) {
  useTodayPageKeys(ctx.tasks);
  useParkingsPageKeys({
    parkings: ctx.parkings ?? [],
    setEditingParkingId: ctx.setEditingTaskId ?? (() => {}),
    onParkingToggleExpand: ctx.onParkingToggleExpand ?? (() => {}),
  });
}
