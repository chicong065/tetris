import { defineConfig } from 'tsup'

/**
 * Build config for publishing `@tetris/engine` to npm.
 *
 * Emits ESM + CJS + `.d.ts` from `src/index.ts`, with source maps and
 * tree-shaking. Test files under `src/__tests__/` are excluded by the
 * entry-point filter (tsup only follows imports from `entry`).
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    resolve: true,
  },
  tsconfig: './tsconfig.build.json',
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
})
