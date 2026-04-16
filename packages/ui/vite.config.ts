import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Auto-update the service worker when a new version is deployed.
      // Combined with `clientsClaim` below, an open tab will reload to
      // the new assets on its own on the next visit.
      registerType: 'autoUpdate',

      // Generate PNG icons from `public/favicon.svg` at build time
      // (driven by `pwa-assets.config.ts`).
      pwaAssets: {
        disabled: false,
        config: true,
      },

      // Precache the favicon (tiny, immediate). The 3.8 MB music
      // track is NOT in this list — it's cached lazily on first
      // playback via the runtimeCaching rule below, so the install
      // footprint stays small and the track is still available
      // offline after you first hear it.
      includeAssets: ['favicon.svg'],

      manifest: {
        name: 'Tetris',
        short_name: 'Tetris',
        description:
          'A Guideline-compliant Tetris built on a headless deterministic engine. Works offline.',
        theme_color: '#0b0d12',
        background_color: '#0b0d12',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
      },

      workbox: {
        // Precache everything the build emits.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],

        // Claim open tabs immediately when a new SW installs so the
        // auto-update actually lands without a second reload.
        clientsClaim: true,
        skipWaiting: true,

        // Runtime caching for assets Workbox doesn't precache: the
        // large music file (excluded from precache by default because
        // of its size) and Google Fonts (external origin).
        runtimeCaching: [
          {
            urlPattern: /\/music\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tetris-music',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
              },
              // Audio range requests (Safari seeks) need opaque responses.
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@engine': path.resolve(__dirname, '../engine/src'),
    },
  },
})
