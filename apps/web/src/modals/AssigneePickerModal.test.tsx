import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserSummary } from '@momentum/shared';
import { AssigneePickerModal } from './AssigneePickerModal';

// Mock useUsers so the modal gets a deterministic roster without wiring
// a real QueryClient into every test.
const { mockUseUsers } = vi.hoisted(() => {
  return { mockUseUsers: vi.fn() };
});
vi.mock('../api/hooks', () => ({
  useUsers: mockUseUsers,
}));

const users: UserSummary[] = [
  {
    id: 'user-nader',
    email: 'nader@omnirev.ai',
    displayName: 'Nader Samadyan',
    avatarColor: '#0FB848',
    deactivatedAt: null,
  },
  {
    id: 'user-sara',
    email: 'sara@omnirev.ai',
    displayName: 'Sara Pourmir',
    avatarColor: '#F7B24F',
    deactivatedAt: null,
  },
  {
    id: 'user-ryan',
    email: 'ryan@omnirev.ai',
    displayName: 'Ryan Ghaffari',
    avatarColor: '#4FD1C5',
    deactivatedAt: null,
  },
];

beforeEach(() => {
  mockUseUsers.mockReset();
  mockUseUsers.mockReturnValue({ data: users, isLoading: false });
});

describe('AssigneePickerModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AssigneePickerModal open={false} onClose={() => {}} onSelect={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all active users with their names', () => {
    render(<AssigneePickerModal open onClose={() => {}} onSelect={() => {}} />);
    expect(screen.getByText('Nader Samadyan')).toBeInTheDocument();
    expect(screen.getByText('Sara Pourmir')).toBeInTheDocument();
    expect(screen.getByText('Ryan Ghaffari')).toBeInTheDocument();
  });

  it('shows loading state while users load', () => {
    mockUseUsers.mockReturnValue({ data: undefined, isLoading: true });
    render(<AssigneePickerModal open onClose={() => {}} onSelect={() => {}} />);
    expect(screen.getByText('Loading team…')).toBeInTheDocument();
  });

  it('shows empty state when no users exist', () => {
    mockUseUsers.mockReturnValue({ data: [], isLoading: false });
    render(<AssigneePickerModal open onClose={() => {}} onSelect={() => {}} />);
    expect(screen.getByText('No active team members.')).toBeInTheDocument();
  });

  it('filters users via the search input', async () => {
    const user = userEvent.setup();
    render(<AssigneePickerModal open onClose={() => {}} onSelect={() => {}} />);
    const input = screen.getByPlaceholderText('Search team…');
    await user.type(input, 'sara');
    expect(screen.getByText('Sara Pourmir')).toBeInTheDocument();
    expect(screen.queryByText('Nader Samadyan')).toBeNull();
    expect(screen.queryByText('Ryan Ghaffari')).toBeNull();
  });

  it('filters by email as well as displayName', async () => {
    const user = userEvent.setup();
    render(<AssigneePickerModal open onClose={() => {}} onSelect={() => {}} />);
    const input = screen.getByPlaceholderText('Search team…');
    await user.type(input, 'ryan@omnirev');
    expect(screen.getByText('Ryan Ghaffari')).toBeInTheDocument();
    expect(screen.queryByText('Nader Samadyan')).toBeNull();
  });

  it('pressing 1 selects the first user + closes', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AssigneePickerModal open onSelect={onSelect} onClose={onClose} />);
    fireEvent.keyDown(window, { key: '1' });
    expect(onSelect).toHaveBeenCalledWith('user-nader');
    expect(onClose).toHaveBeenCalled();
  });

  it('pressing 2 selects the second user', () => {
    const onSelect = vi.fn();
    render(<AssigneePickerModal open onSelect={onSelect} onClose={() => {}} />);
    fireEvent.keyDown(window, { key: '2' });
    expect(onSelect).toHaveBeenCalledWith('user-sara');
  });

  it('pressing Enter confirms the highlighted (default first) row', () => {
    const onSelect = vi.fn();
    render(<AssigneePickerModal open onSelect={onSelect} onClose={() => {}} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('user-nader');
  });

  it('pressing Esc closes without selecting', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AssigneePickerModal open onSelect={onSelect} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('renders "No assignee" option when allowClear is true', () => {
    render(<AssigneePickerModal open onSelect={() => {}} onClose={() => {}} allowClear />);
    expect(screen.getByText('No assignee')).toBeInTheDocument();
  });

  it('clicking the clear option passes null', () => {
    const onSelect = vi.fn();
    render(<AssigneePickerModal open onSelect={onSelect} onClose={() => {}} allowClear />);
    fireEvent.click(screen.getByText('No assignee'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('marks the currentAssigneeId as "current"', () => {
    render(
      <AssigneePickerModal
        open
        onSelect={() => {}}
        onClose={() => {}}
        currentAssigneeId="user-sara"
      />,
    );
    expect(screen.getByText(/· current/)).toBeInTheDocument();
  });
});
