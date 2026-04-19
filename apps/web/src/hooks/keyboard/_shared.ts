import { useUiStore } from '../../store/ui';

/**
 * True when focus is inside an input/textarea/contentEditable element —
 * page-scoped shortcuts must bail in that case so typing in a quick-add
 * bar (or the rich-description editor) doesn't trigger a status cycle.
 */
export function isTypingInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Selector returning the predicates a page-scoped keyboard hook needs
 * to decide whether to fire on a given event. Memoized via Zustand's
 * shallow equality so callers don't re-subscribe on every render.
 */
export function useKeyboardBailFlags() {
  const activeModal = useUiStore((s) => s.activeModal);
  const assigneePickerOpen = useUiStore((s) => s.assigneePickerTarget !== null);
  const involvedPickerOpen = useUiStore((s) => s.involvedPickerTarget !== null);
  return { activeModal, assigneePickerOpen, involvedPickerOpen };
}

/**
 * Return true if a page-scoped keyboard handler should bail before
 * inspecting the key. Centralized so every sub-hook applies the same
 * "is the user busy with something else?" rules:
 *   - the global handler already consumed this event in capture phase
 *     (e.g. `?` opening the shortcuts modal)
 *   - focus is inside an editable element
 *   - a modal / picker is open
 */
export function shouldBailOnEvent(
  e: KeyboardEvent,
  flags: { activeModal: unknown; assigneePickerOpen: boolean; involvedPickerOpen: boolean },
): boolean {
  if (e.defaultPrevented) return true;
  if (isTypingInInput()) return true;
  if (flags.activeModal || flags.assigneePickerOpen || flags.involvedPickerOpen) return true;
  return false;
}
