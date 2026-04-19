import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import type { NodeViewProps } from '@tiptap/react';
import { ImageView } from './ImageWithAuth';
import { useAuthStore } from '../../store/auth';

// Minimal NodeViewProps factory — ImageView only reaches into the fields
// below (node.attrs, selected, editor.isEditable, updateAttributes), so
// stubbing those is enough; the rest of the Tiptap shape is unused here.
function makeProps(overrides: {
  attrs?: Record<string, unknown>;
  selected?: boolean;
  isEditable?: boolean;
  updateAttributes?: (attrs: Record<string, unknown>) => void;
}): NodeViewProps {
  const attrs = { src: '/attachments/abc/download', alt: 'test.png', ...overrides.attrs };
  return {
    node: { attrs, nodeSize: 1, type: { name: 'image' } },
    selected: overrides.selected ?? false,
    editor: { isEditable: overrides.isEditable ?? true },
    updateAttributes: overrides.updateAttributes ?? (() => {}),
    // The rest of NodeViewProps is not touched by ImageView; casting
    // keeps this stub small without reimplementing the full Tiptap node.
  } as unknown as NodeViewProps;
}

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null });
});

describe('ImageView width rendering', () => {
  it('applies inline width style when node has a width attribute', () => {
    const { container } = render(
      <ImageView
        {...makeProps({ attrs: { src: '/attachments/x/download', alt: 'a', width: 320 } })}
      />,
    );
    const img = container.querySelector('img')!;
    expect(img).toBeInTheDocument();
    expect(img.style.width).toBe('320px');
  });

  it('renders no inline width when the node has no width attribute', () => {
    const { container } = render(
      <ImageView {...makeProps({ attrs: { src: '/attachments/x/download', alt: 'a' } })} />,
    );
    const img = container.querySelector('img')!;
    expect(img.style.width).toBe('');
  });
});

describe('ImageView resize handle visibility', () => {
  it('renders the resize handle when selected and editable', () => {
    const { container } = render(
      <ImageView {...makeProps({ selected: true, isEditable: true })} />,
    );
    expect(container.querySelector('.task-attachment-image-resize-handle')).not.toBeNull();
  });

  it('hides the handle when not selected', () => {
    const { container } = render(
      <ImageView {...makeProps({ selected: false, isEditable: true })} />,
    );
    expect(container.querySelector('.task-attachment-image-resize-handle')).toBeNull();
  });

  it('hides the handle on a read-only editor even when selected', () => {
    const { container } = render(
      <ImageView {...makeProps({ selected: true, isEditable: false })} />,
    );
    expect(container.querySelector('.task-attachment-image-resize-handle')).toBeNull();
  });

  it('sets data-selected on the wrapper when the handle is visible', () => {
    const { container } = render(
      <ImageView {...makeProps({ selected: true, isEditable: true })} />,
    );
    const wrapper = container.querySelector('.task-attachment-image-wrap') as HTMLElement;
    expect(wrapper.getAttribute('data-selected')).toBe('true');
  });
});

describe('ImageView drag resize', () => {
  it('commits a clamped pixel width via updateAttributes on pointerup', () => {
    const updateAttributes = vi.fn();
    const { container } = render(
      <ImageView
        {...makeProps({
          attrs: { src: '/attachments/x/download', alt: 'a', width: 400 },
          selected: true,
          isEditable: true,
          updateAttributes,
        })}
      />,
    );

    const wrapper = container.querySelector('.task-attachment-image-wrap') as HTMLElement;
    const handle = container.querySelector('.task-attachment-image-resize-handle') as HTMLElement;

    // JSDOM returns 0 for layout metrics; stub getBoundingClientRect on the
    // wrapper (drag starts from its current width) and clientWidth on its
    // parent (the upper clamp).
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(wrapper.parentElement!, 'clientWidth', {
      configurable: true,
      value: 600,
    });

    // Shrink drag: -200px from the start — should clamp above MIN (80), so
    // we end at 200.
    act(() => {
      fireEvent.pointerDown(handle, { clientX: 500, clientY: 100 });
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, clientY: 100 }));
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 300, clientY: 100 }));
    });

    expect(updateAttributes).toHaveBeenCalledTimes(1);
    expect(updateAttributes).toHaveBeenCalledWith({ width: 200 });
  });

  it('clamps to the 80px minimum when dragged past the left edge', () => {
    const updateAttributes = vi.fn();
    const { container } = render(
      <ImageView
        {...makeProps({
          attrs: { src: '/attachments/x/download', alt: 'a', width: 200 },
          selected: true,
          isEditable: true,
          updateAttributes,
        })}
      />,
    );

    const wrapper = container.querySelector('.task-attachment-image-wrap') as HTMLElement;
    const handle = container.querySelector('.task-attachment-image-resize-handle') as HTMLElement;

    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 150,
      top: 0,
      left: 0,
      right: 200,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(wrapper.parentElement!, 'clientWidth', {
      configurable: true,
      value: 600,
    });

    act(() => {
      fireEvent.pointerDown(handle, { clientX: 300, clientY: 100 });
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: 100 }));
    });

    expect(updateAttributes).toHaveBeenCalledWith({ width: 80 });
  });

  it('clamps to the parent clientWidth when dragged past the right edge', () => {
    const updateAttributes = vi.fn();
    const { container } = render(
      <ImageView
        {...makeProps({
          attrs: { src: '/attachments/x/download', alt: 'a', width: 200 },
          selected: true,
          isEditable: true,
          updateAttributes,
        })}
      />,
    );

    const wrapper = container.querySelector('.task-attachment-image-wrap') as HTMLElement;
    const handle = container.querySelector('.task-attachment-image-resize-handle') as HTMLElement;

    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 150,
      top: 0,
      left: 0,
      right: 200,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(wrapper.parentElement!, 'clientWidth', {
      configurable: true,
      value: 500,
    });

    act(() => {
      fireEvent.pointerDown(handle, { clientX: 300, clientY: 100 });
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 9999, clientY: 100 }));
    });

    expect(updateAttributes).toHaveBeenCalledWith({ width: 500 });
  });
});
