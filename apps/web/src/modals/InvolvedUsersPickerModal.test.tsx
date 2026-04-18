import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { UserSummary } from '@momentum/shared';
import { InvolvedUsersPickerModal } from './InvolvedUsersPickerModal';

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

describe('InvolvedUsersPickerModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <InvolvedUsersPickerModal
        open={false}
        onClose={() => {}}
        onConfirm={() => {}}
        initialIds={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all users and reflects initialIds as selected', () => {
    render(
      <InvolvedUsersPickerModal
        open
        onClose={() => {}}
        onConfirm={() => {}}
        initialIds={['user-sara']}
      />,
    );
    expect(screen.getByText('Nader Samadyan')).toBeInTheDocument();
    expect(screen.getByText('Sara Pourmir')).toBeInTheDocument();
    expect(screen.getByText('Ryan Ghaffari')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('excludes a user when excludeId is set', () => {
    render(
      <InvolvedUsersPickerModal
        open
        onClose={() => {}}
        onConfirm={() => {}}
        initialIds={[]}
        excludeId="user-nader"
      />,
    );
    expect(screen.queryByText('Nader Samadyan')).toBeNull();
    expect(screen.getByText('Sara Pourmir')).toBeInTheDocument();
  });

  it('clicking a user toggles selection and updates the counter', () => {
    render(
      <InvolvedUsersPickerModal
        open
        onClose={() => {}}
        onConfirm={() => {}}
        initialIds={[]}
      />,
    );
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sara Pourmir'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ryan Ghaffari'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    // Clicking again deselects.
    fireEvent.click(screen.getByText('Sara Pourmir'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('pressing 1 toggles the first user', () => {
    render(
      <InvolvedUsersPickerModal
        open
        onClose={() => {}}
        onConfirm={() => {}}
        initialIds={[]}
      />,
    );
    fireEvent.keyDown(window, { key: '1' });
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('Enter commits the current selection via onConfirm', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <InvolvedUsersPickerModal
        open
        onClose={onClose}
        onConfirm={onConfirm}
        initialIds={['user-sara']}
      />,
    );
    // Add Ryan.
    fireEvent.keyDown(window, { key: '3' }); // Ryan at index 2 → key "3"
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const submitted = onConfirm.mock.calls[0]![0] as string[];
    expect(new Set(submitted)).toEqual(new Set(['user-sara', 'user-ryan']));
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc cancels without calling onConfirm', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <InvolvedUsersPickerModal
        open
        onClose={onClose}
        onConfirm={onConfirm}
        initialIds={[]}
      />,
    );
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('confirms an empty array when nothing is selected', () => {
    const onConfirm = vi.fn();
    render(
      <InvolvedUsersPickerModal
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        initialIds={[]}
      />,
    );
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it('re-initializes selection when initialIds changes and modal reopens', () => {
    const { rerender } = render(
      <InvolvedUsersPickerModal
        open
        onClose={() => {}}
        onConfirm={() => {}}
        initialIds={['user-sara']}
      />,
    );
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Close.
    rerender(
      <InvolvedUsersPickerModal
        open={false}
        onClose={() => {}}
        onConfirm={() => {}}
        initialIds={['user-sara', 'user-ryan']}
      />,
    );
    // Reopen with new initialIds.
    rerender(
      <InvolvedUsersPickerModal
        open
        onClose={() => {}}
        onConfirm={() => {}}
        initialIds={['user-sara', 'user-ryan']}
      />,
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });
});
