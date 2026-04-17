import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#4F8EF7',
          hover: '#6BA1FA',
        },
        m: {
          bg: 'var(--m-bg)',
          'bg-60': 'var(--m-bg-60)',
          'bg-30': 'var(--m-bg-30)',
          surface: 'var(--m-surface)',
          'surface-95': 'var(--m-surface-95)',
          'surface-60': 'var(--m-surface-60)',
          'surface-50': 'var(--m-surface-50)',
          'surface-40': 'var(--m-surface-40)',
          'surface-hover': 'var(--m-surface-hover)',
          'surface-raised': 'var(--m-surface-raised)',
          fg: 'var(--m-fg)',
          'fg-strong': 'var(--m-fg-strong)',
          'fg-secondary': 'var(--m-fg-secondary)',
          'fg-tertiary': 'var(--m-fg-tertiary)',
          'fg-muted': 'var(--m-fg-muted)',
          'fg-dim': 'var(--m-fg-dim)',
          border: 'var(--m-border)',
          'border-strong': 'var(--m-border-strong)',
          'border-subtle': 'var(--m-border-subtle)',
          overlay: 'var(--m-overlay)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
