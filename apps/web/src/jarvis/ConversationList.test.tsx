import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { JarvisConversationSummary } from '@momentum/shared';
import { ConversationList } from './ConversationList';

function sample(overrides: Partial<JarvisConversationSummary> = {}): JarvisConversationSummary {
  return {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    title: 'Prior conversation',
    createdAt: '2026-04-18T09:00:00.000Z',
    updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(), // 5 minutes ago
    archivedAt: null,
    ...overrides,
  };
}

function renderList(props: Partial<Parameters<typeof ConversationList>[0]> = {}) {
  const defaults = {
    conversations: [sample()],
    activeConversationId: null,
    isLoading: false,
    onNewConversation: vi.fn(),
    onSelect: vi.fn(),
    searchValue: '',
    onSearchChange: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <ConversationList {...defaults} {...props} />
    </MemoryRouter>,
  );
}

describe('ConversationList', () => {
  it('renders rows with title and a relative timestamp', () => {
    renderList();
    expect(screen.getByText('Prior conversation')).toBeInTheDocument();
    expect(screen.getByText(/5m ago/)).toBeInTheDocument();
  });

  it('marks the active conversation with aria-current=page', () => {
    renderList({ activeConversationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' });
    const active = screen.getByRole('button', { current: 'page' });
    expect(active).toHaveTextContent('Prior conversation');
  });

  it("shows the 'No conversations yet' + keycap hint when list is empty", () => {
    renderList({ conversations: [] });
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    // `n` keycap hint
    expect(screen.getByText('n')).toBeInTheDocument();
  });

  it("shows 'No matches' when search filters everything out", () => {
    renderList({
      conversations: [sample({ title: 'Boudin outreach plan' })],
      searchValue: 'chipotle',
    });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('filters the list client-side by search term (case-insensitive)', () => {
    renderList({
      conversations: [
        sample({ id: 'a', title: 'Boudin outreach plan' }),
        sample({ id: 'b', title: 'Chipotle QBR notes' }),
      ],
      searchValue: 'bou',
    });
    expect(screen.getByText('Boudin outreach plan')).toBeInTheDocument();
    expect(screen.queryByText('Chipotle QBR notes')).not.toBeInTheDocument();
  });

  it('fires onNewConversation when the + button is clicked', () => {
    const onNewConversation = vi.fn();
    renderList({ onNewConversation });
    fireEvent.click(screen.getByRole('button', { name: /new conversation/i }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it('fires onSearchChange as the user types', () => {
    const onSearchChange = vi.fn();
    renderList({ onSearchChange });
    fireEvent.change(screen.getByRole('searchbox', { name: /search conversations/i }), {
      target: { value: 'boudin' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('boudin');
  });

  it('fires onSelect when a row is clicked', () => {
    const onSelect = vi.fn();
    renderList({ onSelect });
    fireEvent.click(screen.getByText('Prior conversation'));
    expect(onSelect).toHaveBeenCalledWith('cccccccc-cccc-cccc-cccc-cccccccccccc');
  });

  it('shows a skeleton placeholder while loading', () => {
    const { container } = renderList({ isLoading: true, conversations: [] });
    // Six skeleton rows are rendered.
    expect(
      container.querySelectorAll('li[aria-hidden], ul[aria-hidden] li').length,
    ).toBeGreaterThan(0);
    // No actual row text
    expect(screen.queryByText('Prior conversation')).not.toBeInTheDocument();
  });
});
