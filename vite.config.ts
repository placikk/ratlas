/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Ratlas',
        short_name: 'Ratlas',
        description: 'Szczurza mapa Wrocławia: wypatruj szczurów, zbieraj raciki i odkrywaj sekretne osiągnięcia.',
        lang: 'pl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F1EF',
        theme_color: '#C98A8F',
        icons: [
          { src: 'pwa-64x64.png?v=2', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png?v=2', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png?v=2', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts', 'scripts/**/*.test.ts'],
    mockReset: true,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
  },
})
