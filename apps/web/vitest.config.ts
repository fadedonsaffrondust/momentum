import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { sharedTestConfig } from '../../vitest.shared';

const here = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(here, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
    },
  }),
);
