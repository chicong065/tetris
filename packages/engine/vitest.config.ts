import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      include: ['src/**/*.ts'],
      // Pure type definitions and the public barrel have no executable
      // code to exercise — both compile away at build time.
      exclude: ['src/types.ts', 'src/index.ts', 'src/**/*.test.ts', 'src/__tests__/**'],
    },
  },
})
