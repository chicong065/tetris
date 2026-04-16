/**
 * Config for `@vite-pwa/assets-generator`. Runs at build time to turn
 * the single SVG source into the PNG favicon / maskable / apple-touch
 * icons the PWA manifest needs. Re-run by the `vite-plugin-pwa`
 * integration whenever the source SVG changes.
 */

import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
