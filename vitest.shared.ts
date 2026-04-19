// Shared Vitest config. Each package's vitest.config.ts merges this
// with package-specific overrides via mergeConfig.
import { defineConfig } from 'vitest/config';

export const sharedTestConfig = defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
