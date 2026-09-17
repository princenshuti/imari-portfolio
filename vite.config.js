import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Imari by Maxventures',
        short_name: 'Imari',
        description: 'Personal wealth & asset tracker for Rwanda',
        theme_color: '#0D4B3A',
        background_color: '#0D1117',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="%230D4B3A"/><defs><linearGradient id="g" x1="0%25" y1="50%25" x2="100%25" y2="50%25"><stop offset="0%25" stop-color="%231848D8"/><stop offset="50%25" stop-color="%237030C4"/><stop offset="100%25" stop-color="%23E85010"/></linearGradient></defs><path d="M 256 256 C 260 210 370 180 390 256 C 410 332 275 310 256 256 C 237 180 140 160 120 256 C 100 332 252 310 256 256" fill="none" stroke="url(%23g)" stroke-width="56" stroke-linecap="round"/></svg>',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // No `png`: og-image.png is for social crawlers, not the app shell.
        // The spreadsheet libraries are lazy-loaded on the import path and
        // cached by the browser on first use — precaching them forced every
        // first visit to download ~1.4 MB it would likely never run.
        // `html` is deliberately NOT precached: a precached index.html meant every
        // first visit after a deploy showed the previous build until a second
        // load (users saw new features "missing"). The shell is served
        // network-first below and only falls back to cache when offline.
        globPatterns: ['**/*.{js,css,ico,svg,woff2}'],
        navigateFallback: null,
        // Lazy heavyweights stay OUT of the precache: the spreadsheet libs
        // (import path only) and the entire Spline 3D family (landing finale
        // only — react-spline, physics, navmesh, opentype, howler, boolean,
        // gaussian-splat, process, ui are all its split chunks). The browser
        // HTTP cache covers them after first use.
        globIgnores: [
          '**/exceljs*', '**/xlsx*',
          '**/react-spline*', '**/physics*', '**/navmesh*', '**/opentype*',
          '**/howler*', '**/boolean-*', '**/gaussian-splat*', '**/process-*',
          '**/ui-*',
        ],
        runtimeCaching: [
          {
            // App shell (index.html for any in-app route): fresh from the network,
            // cached copy only when offline or the network stalls > 3 s.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell', networkTimeoutSeconds: 3, expiration: { maxEntries: 4 }, fetchOptions: { cache: 'no-cache' } },
          },
          {
            urlPattern: /^https:\/\/api\.coingecko\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'market-data', expiration: { maxAgeSeconds: 900 } },
          },
          {
            urlPattern: /^https:\/\/open\.er-api\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fx-data', expiration: { maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
