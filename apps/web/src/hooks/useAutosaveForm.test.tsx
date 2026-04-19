import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutosaveForm } from './useAutosaveForm';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

interface Form {
  title: string;
  count: number;
}

describe('useAutosaveForm', () => {
  it('schedules a save after the debounce window', () => {
    const onSave = vi.fn();
    const initial: Form = { title: 'a', count: 0 };
    const { result } = renderHook(() => useAutosaveForm({ initial, onSave, debounceMs: 100 }));

    expect(result.current.status).toBe('idle');

    act(() => {
      result.current.setField('title', 'b');
    });

    expect(result.current.status).toBe('pending');
    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ title: 'b', count: 0 });
    expect(result.current.status).toBe('saved');
  });

  it('coalesces rapid edits into a single save', () => {
    const onSave = vi.fn();
    const initial: Form = { title: 'a', count: 0 };
    const { result } = renderHook(() => useAutosaveForm({ initial, onSave, debounceMs: 100 }));

    act(() => {
      result.current.setField('title', 'b');
      vi.advanceTimersByTime(50);
      result.current.setField('title', 'bc');
      vi.advanceTimersByTime(50);
      result.current.setField('title', 'bcd');
    });

    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ title: 'bcd', count: 0 });
  });

  it('flush() forces an immediate save', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveForm({ initial: { title: 'a', count: 0 } as Form, onSave, debounceMs: 500 }),
    );

    act(() => {
      result.current.setField('title', 'b');
    });
    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      result.current.flush();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ title: 'b', count: 0 });
    expect(result.current.status).toBe('saved');
  });

  it('flushes pending save when resetKey changes (mid-edit resource switch)', () => {
    const onSave = vi.fn();
    let resourceId = 'r1';
    let initial: Form = { title: 'one', count: 0 };

    const { result, rerender } = renderHook(() =>
      useAutosaveForm({ initial, onSave, resetKey: resourceId, debounceMs: 500 }),
    );

    // Edit resource 1; do not wait for debounce.
    act(() => {
      result.current.setField('title', 'one-edited');
    });

    // Switch to resource 2.
    resourceId = 'r2';
    initial = { title: 'two', count: 99 };
    rerender();

    // Pending save for r1 fired immediately on switch.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ title: 'one-edited', count: 0 });

    // Values now reflect r2's initial.
    expect(result.current.values).toEqual({ title: 'two', count: 99 });
  });

  it('cancels pending save when isUnchanged becomes true', () => {
    const onSave = vi.fn();
    const initial: Form = { title: 'a', count: 0 };
    let serverTitle = 'a';
    const { result, rerender } = renderHook(() =>
      useAutosaveForm({
        initial,
        onSave,
        debounceMs: 100,
        isUnchanged: (v) => v.title === serverTitle,
      }),
    );

    act(() => {
      result.current.setField('title', 'b');
    });
    expect(result.current.status).toBe('pending');

    // Server caught up — `isUnchanged` now returns true. Trigger a re-evaluation
    // by re-rendering (which the consumer would do via state change anyway).
    serverTitle = 'b';
    act(() => {
      result.current.setField('title', 'b'); // same value, but re-fires the values effect
    });
    rerender();

    // The status should be idle and no save should fire even after debounce.
    expect(result.current.status).toBe('idle');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('flushes pending save on unmount', () => {
    const onSave = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAutosaveForm({ initial: { title: 'a', count: 0 } as Form, onSave, debounceMs: 500 }),
    );

    act(() => {
      result.current.setField('title', 'b');
    });
    expect(onSave).not.toHaveBeenCalled();

    unmount();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ title: 'b', count: 0 });
  });

  it('reports error status when onSave throws synchronously', () => {
    const onSave = vi.fn(() => {
      throw new Error('boom');
    });
    const { result } = renderHook(() =>
      useAutosaveForm({ initial: { title: 'a', count: 0 } as Form, onSave, debounceMs: 50 }),
    );

    act(() => {
      result.current.setField('title', 'b');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('error');
  });

  it('setField composes into setValues (independent fields update independently)', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveForm({ initial: { title: 'a', count: 0 } as Form, onSave, debounceMs: 100 }),
    );

    act(() => {
      result.current.setField('title', 'b');
      result.current.setField('count', 5);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ title: 'b', count: 5 });
  });
});
