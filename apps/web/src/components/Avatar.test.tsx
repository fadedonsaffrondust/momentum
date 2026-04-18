import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UserSummary } from '@momentum/shared';
import { Avatar, getInitials } from './Avatar';
import { AvatarStack } from './AvatarStack';

function makeUser(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'nader@omnirev.ai',
    displayName: 'Nader Samadyan',
    avatarColor: '#0FB848',
    deactivatedAt: null,
    ...overrides,
  };
}

describe('getInitials', () => {
  it('uses first letter of first and last word of displayName', () => {
    expect(getInitials({ displayName: 'Nader Samadyan', email: 'n@x.com' })).toBe('NS');
  });

  it('handles single-word displayName by taking the first two letters', () => {
    expect(getInitials({ displayName: 'Sara', email: 's@x.com' })).toBe('SA');
  });

  it('handles three-word displayName (first + last)', () => {
    expect(getInitials({ displayName: 'Mary Jane Watson', email: 'm@x.com' })).toBe('MW');
  });

  it('falls back to email local-part when displayName is empty', () => {
    expect(getInitials({ displayName: '', email: 'nader@omnirev.ai' })).toBe('NA');
  });

  it('falls back to email local-part when displayName is whitespace', () => {
    expect(getInitials({ displayName: '   ', email: 'ryan@omnirev.ai' })).toBe('RY');
  });

  it('upper-cases lowercase displayName', () => {
    expect(getInitials({ displayName: 'john doe', email: 'j@x.com' })).toBe('JD');
  });

  it('falls back to ?? when both empty', () => {
    expect(getInitials({ displayName: '', email: '@example.com' })).toBe('??');
  });
});

describe('Avatar', () => {
  it('renders initials', () => {
    render(<Avatar user={makeUser()} />);
    expect(screen.getByText('NS')).toBeInTheDocument();
  });

  it('applies the user avatarColor as background for active users', () => {
    render(<Avatar user={makeUser({ avatarColor: '#0FB848' })} />);
    const el = screen.getByText('NS');
    expect((el as HTMLElement).style.backgroundColor).toBeTruthy();
    expect(el.getAttribute('data-deactivated')).toBeNull();
  });

  it('renders deactivated users with grey styling + tooltip', () => {
    render(
      <Avatar
        user={makeUser({
          deactivatedAt: '2026-03-01T00:00:00.000Z',
          displayName: 'Old User',
        })}
      />,
    );
    const el = screen.getByText('OU');
    expect(el.getAttribute('data-deactivated')).toBe('true');
    expect(el.getAttribute('title')).toContain('(deactivated)');
  });

  it('renders as a button when onClick is provided', () => {
    const handler = () => {};
    render(<Avatar user={makeUser()} onClick={handler} />);
    // aria-label matches the tooltip for the button.
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders as a span by default (not a button)', () => {
    render(<Avatar user={makeUser()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('AvatarStack', () => {
  const users = [
    makeUser({ id: '1', displayName: 'Alice One' }),
    makeUser({ id: '2', displayName: 'Bob Two' }),
    makeUser({ id: '3', displayName: 'Carol Three' }),
    makeUser({ id: '4', displayName: 'Dan Four' }),
    makeUser({ id: '5', displayName: 'Eve Five' }),
  ];

  it('renders nothing when users list is empty', () => {
    const { container } = render(<AvatarStack users={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all avatars up to max', () => {
    render(<AvatarStack users={users.slice(0, 3)} max={4} />);
    expect(screen.getByText('AO')).toBeInTheDocument();
    expect(screen.getByText('BT')).toBeInTheDocument();
    expect(screen.getByText('CT')).toBeInTheDocument();
    // No overflow since 3 <= 4
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('shows +N overflow chip when users exceed max', () => {
    render(<AvatarStack users={users} max={3} />);
    expect(screen.getByText('AO')).toBeInTheDocument();
    expect(screen.getByText('BT')).toBeInTheDocument();
    expect(screen.getByText('CT')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    // The later-on users are hidden behind the overflow chip.
    expect(screen.queryByText('DF')).toBeNull();
    expect(screen.queryByText('EF')).toBeNull();
  });

  it('overflow chip has a helpful aria-label', () => {
    render(<AvatarStack users={users} max={3} />);
    expect(screen.getByLabelText('2 more users')).toBeInTheDocument();
  });

  it('pluralizes aria-label correctly for 1 extra', () => {
    render(<AvatarStack users={users.slice(0, 4)} max={3} />);
    expect(screen.getByLabelText('1 more user')).toBeInTheDocument();
  });
});
