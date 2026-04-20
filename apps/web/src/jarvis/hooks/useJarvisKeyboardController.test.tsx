import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { isJarvisPath, useJarvisKeyboardController } from './useJarvisKeyboardController';

function Probe({ onNewConversation }: { onNewConversation: () => void }) {
  useJarvisKeyboardController({ onNewConversation });
  return null;
}

function wrap(children: ReactNode, initialPath: string) {
  return <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>;
}

function dispatchKey(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }));
  });
}

describe('isJarvisPath', () => {
  it('matches /jarvis and /jarvis/:id but not /jarvishidden', () => {
    expect(isJarvisPath('/jarvis')).toBe(true);
    expect(isJarvisPath('/jarvis/abc')).toBe(true);
    expect(isJarvisPath('/jarvishidden')).toBe(false);
    expect(isJarvisPath('/')).toBe(false);
  });
});

describe('useJarvisKeyboardController', () => {
  let composer: HTMLTextAreaElement;
  let list: HTMLDivElement;
  let rows: HTMLButtonElement[];

  beforeEach(() => {
    // Build a DOM fixture that mirrors the real ConversationList +
    // Composer attributes — `[data-jarvis-conversation-list]` on the
    // scroll container and `[data-jarvis-composer]` on the textarea.
    composer = document.createElement('textarea');
    composer.setAttribute('data-jarvis-composer', 'true');
    document.body.appendChild(composer);

    list = document.createElement('div');
    list.setAttribute('data-jarvis-conversation-list', 'true');
    rows = [
      document.createElement('button'),
      document.createElement('button'),
      document.createElement('button'),
    ];
    rows.forEach((b, i) => {
      b.textContent = `row ${i}`;
      list.appendChild(b);
    });
    document.body.appendChild(list);
  });

  afterEach(() => {
    composer.remove();
    list.remove();
  });

  it('focuses the composer on `/` when on /jarvis', () => {
    const onNew = vi.fn();
    render(wrap(<Probe onNewConversation={onNew} />, '/jarvis'));
    dispatchKey('/');
    expect(document.activeElement).toBe(composer);
  });

  it('focuses the first conversation row on `j` when nothing in the list is focused', () => {
    render(wrap(<Probe onNewConversation={vi.fn()} />, '/jarvis'));
    dispatchKey('j');
    expect(document.activeElement).toBe(rows[0]);
  });

  it('cycles through conversation rows with j / k', () => {
    render(wrap(<Probe onNewConversation={vi.fn()} />, '/jarvis'));
    rows[1]!.focus();
    dispatchKey('j');
    expect(document.activeElement).toBe(rows[2]);
    dispatchKey('j');
    // Wraps back to the first row.
    expect(document.activeElement).toBe(rows[0]);
    dispatchKey('k');
    // Wraps backwards to the last row.
    expect(document.activeElement).toBe(rows[2]);
  });

  it('calls onNewConversation when momentum:new-thing fires on /jarvis', () => {
    const onNew = vi.fn();
    render(wrap(<Probe onNewConversation={onNew} />, '/jarvis'));
    act(() => {
      window.dispatchEvent(new CustomEvent('momentum:new-thing'));
    });
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('bails when the user is typing in an input (does not hijack `/`)', () => {
    render(wrap(<Probe onNewConversation={vi.fn()} />, '/jarvis'));
    const otherInput = document.createElement('input');
    document.body.appendChild(otherInput);
    otherInput.focus();
    dispatchKey('/');
    // Composer did not steal focus.
    expect(document.activeElement).toBe(otherInput);
    otherInput.remove();
  });

  it('bails when off /jarvis (no-op on /team)', () => {
    const onNew = vi.fn();
    render(wrap(<Probe onNewConversation={onNew} />, '/team'));
    dispatchKey('/');
    dispatchKey('j');
    expect(document.activeElement).toBe(document.body);
    act(() => {
      window.dispatchEvent(new CustomEvent('momentum:new-thing'));
    });
    expect(onNew).not.toHaveBeenCalled();
  });

  it('ignores modifier-combo presses (so /+Cmd still routes to the browser)', () => {
    render(wrap(<Probe onNewConversation={vi.fn()} />, '/jarvis'));
    dispatchKey('/', { metaKey: true });
    expect(document.activeElement).not.toBe(composer);
  });
});
