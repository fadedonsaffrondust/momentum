import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react v13+ doesn't auto-cleanup on vitest; without
// this every `render` leaks the DOM into the next test and duplicate-
// match queries start failing.
afterEach(() => {
  cleanup();
});
