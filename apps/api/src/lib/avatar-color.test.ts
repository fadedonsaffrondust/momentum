import { describe, it, expect } from 'vitest';
import { ROLE_COLOR_PALETTE } from '@momentum/shared';
import { avatarColorForEmail } from './avatar-color.ts';

describe('avatarColorForEmail', () => {
  it('returns a palette color for any input', () => {
    const color = avatarColorForEmail('nader@omnirev.ai');
    expect(ROLE_COLOR_PALETTE).toContain(color);
  });

  it('is deterministic for the same email', () => {
    expect(avatarColorForEmail('sara@omnirev.ai')).toBe(avatarColorForEmail('sara@omnirev.ai'));
  });

  it('is case-insensitive', () => {
    expect(avatarColorForEmail('Nader@Omnirev.AI')).toBe(avatarColorForEmail('nader@omnirev.ai'));
  });

  it('distributes reasonably across the palette for small input variations', () => {
    const colors = new Set<string>();
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']) {
      colors.add(avatarColorForEmail(`${name}@omnirev.ai`));
    }
    // 12 distinct emails across 8 colors — at least 3 distinct colors expected.
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it('never returns outside the palette', () => {
    for (const input of ['', 'x', 'longer@email.with.many.dots.omnirev.ai', '1234567890']) {
      expect(ROLE_COLOR_PALETTE).toContain(avatarColorForEmail(input));
    }
  });
});
