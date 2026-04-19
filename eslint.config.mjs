// Flat ESLint config for the Momentum monorepo.
// Phase 1 baseline — kept lean so the existing codebase passes today.
// Phase 5 will:
//   - promote @typescript-eslint/no-explicit-any to 'error'
//   - promote @typescript-eslint/ban-ts-comment to 'error'
//   - promote @typescript-eslint/no-unused-vars to 'error'
//   - promote react-hooks/exhaustive-deps to 'error'
//   - flip linterOptions.reportUnusedDisableDirectives back on
//   - add import/order, tailwindcss/no-custom-classname
//   - add a no-restricted-syntax rule banning text-[Npx] arbitrary classes
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/drizzle/**',
      '**/*.config.{js,mjs,cjs,ts}',
      '**/vite.config.ts',
      '**/vitest.config.ts',
      '**/vitest.shared.ts',
      '**/tailwind.config.ts',
      '**/postcss.config.cjs',
      '**/drizzle.config.ts',
      'packages/db/src/migrate.ts',
    ],
  },
  {
    // Phase 5 turns this back on; for now we tolerate dead disables so the
    // existing codebase passes without churn.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // CLAUDE.md design rule: never `transition-all`; name the animating properties.
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/transition-all/]",
          message:
            "`transition-all` is forbidden — name the animating properties explicitly (CLAUDE.md frontend design rules).",
        },
      ],
    },
  },
  // React surface (web only).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
);
