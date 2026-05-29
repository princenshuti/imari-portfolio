import { defineConfig } from 'vitest/config';

// Standalone Vitest config — intentionally does NOT extend vite.config.js so the
// PWA/Workbox + React plugins don't load during tests. The Insight Engine and
// freshness layer are pure JS (no JSX), so the default node environment is enough.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
