import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'pending' | 'saved' | 'error';

export interface UseAutosaveFormOptions<T> {
  /**
   * Initial values. Re-evaluated on every render but only consumed when
   * `resetKey` changes (so giving an inline object literal is safe).
   */
  initial: T;
  /** Called with the latest values when the debounce expires. */
  onSave: (values: T) => void;
  /** Debounce window in ms. Default 500. */
  debounceMs?: number;
  /**
   * When this changes (typically a resource id like `task.id`), any
   * pending save is flushed for the OUTGOING resource and the staged
   * values are then reset to the new `initial`. This is the bit that
   * makes mid-edit navigation between resources safe — without it the
   * pending save would either fire with the wrong id (clobbering the
   * new resource) or be dropped silently.
   */
  resetKey?: string | null | undefined;
  /**
   * Return true to short-circuit the next save (cancels any pending
   * timer and does NOT schedule a new one). Use this to skip when the
   * staged values match the server (no-op write) AND for invalid /
   * partial states where saving would be harmful (e.g. an empty title
   * would clobber the stored title).
   */
  isUnchanged?: (values: T) => boolean;
}

export interface UseAutosaveFormResult<T> {
  values: T;
  setValues: (next: T | ((prev: T) => T)) => void;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  /**
   * 'idle' — nothing pending.
   * 'pending' — edit made, debounce timer running, save NOT yet sent.
   * 'saved' — debounce fired, `onSave` was called.
   * 'error' — `onSave` threw synchronously. Async errors are the
   *   caller's responsibility (e.g. via the underlying mutation hook).
   */
  status: AutosaveStatus;
  /** Force-flush any pending save right now (e.g. on Close button). */
  flush: () => void;
}

/**
 * Generic debounced-autosave form helper. Lifts the
 * useState-wall + sync-on-resource-change + flush-on-deps + cleanup
 * pattern out of TaskDetailDrawer / OverviewTab so every autosaving
 * surface in the app shares a single, tested implementation.
 *
 * Behavior contract:
 *   1. Local `values` state initialized from `initial`.
 *   2. Editing `values` schedules `onSave(values)` after `debounceMs`.
 *   3. `isUnchanged(values)` short-circuits both pending and new saves.
 *   4. On `resetKey` change: flush pending → reset values to new initial.
 *   5. On unmount: flush pending.
 *   6. `flush()` exposes the same flush-now path for explicit triggers
 *      (Close button, Escape handler, j/k navigation in Today view).
 */
export function useAutosaveForm<T>({
  initial,
  onSave,
  debounceMs = 500,
  resetKey,
  isUnchanged,
}: UseAutosaveFormOptions<T>): UseAutosaveFormResult<T> {
  const [values, setValues] = useState<T>(initial);
  const [status, setStatus] = useState<AutosaveStatus>('idle');

  // Refs hold the rolling pending payload + timer + latest callbacks so
  // flush() and the cleanup paths always see the freshest values without
  // re-binding their effect.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const isUnchangedRef = useRef(isUnchanged);
  isUnchangedRef.current = isUnchanged;
  // Latest `initial` is captured per render so the resetKey effect picks
  // up the *new* resource's data rather than the value at first mount.
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const payload = pendingRef.current;
    if (payload === null) return;
    pendingRef.current = null;
    try {
      onSaveRef.current(payload);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, []);

  // Reset on resetKey change: flush the OUTGOING resource's pending edit
  // first (uses refs that still hold the old payload), then point the
  // local state at the new resource's initial values.
  useEffect(() => {
    flush();
    setValues(initialRef.current);
    setStatus('idle');
    // `initial` intentionally NOT a dep — only resetKey drives reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Schedule debounced save whenever values change. Skip the first run
  // (which fires on initial mount with `values === initial` because of
  // useState's initialization) — that isn't an "edit" worth saving.
  // Subsequent setValues from the resetKey effect ALSO triggers this,
  // but it's caught by the `isUnchanged` short-circuit (or, if absent,
  // is harmlessly written back as a no-op save by the consumer).
  const isFirstValuesRunRef = useRef(true);
  useEffect(() => {
    if (isFirstValuesRunRef.current) {
      isFirstValuesRunRef.current = false;
      return;
    }

    if (isUnchangedRef.current?.(values)) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
      setStatus('idle');
      return;
    }

    pendingRef.current = values;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('pending');
    timerRef.current = setTimeout(() => {
      const payload = pendingRef.current;
      timerRef.current = null;
      if (payload === null) return;
      pendingRef.current = null;
      try {
        onSaveRef.current(payload);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, debounceMs);
    // values is the only meaningful dep; debounceMs change while editing
    // would re-schedule, which is fine.
  }, [values, debounceMs]);

  // Flush on unmount. Cleanup closure sees the latest refs.
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { values, setValues, setField, status, flush };
}
