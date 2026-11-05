import { defineConfig } from 'vitest/config'

// Runs against the Neon branch from .env.integration, never production.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.integration.setup.ts'],
    include: ['src/**/*.integration.test.ts'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    // A suspended Neon compute needs a few seconds to wake up.
    testTimeout: 20_000,
  },
})
