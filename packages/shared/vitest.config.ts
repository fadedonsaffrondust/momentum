import { mergeConfig, defineConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared';

export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      setupFiles: ['src/test/setup.ts'],
    },
  }),
);
