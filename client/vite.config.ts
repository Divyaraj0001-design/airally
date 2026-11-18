import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'AirAlly — Urban Air Quality Assistant',
        short_name: 'AirAlly',
        description: 'GenAI-powered air quality assistant for families',
        theme_color: '#a8d654',
        background_color: '#ebedf0',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'], motion: ['framer-motion'], vendor: ['react', 'react-dom', 'zustand', 'i18next', 'react-i18next'] } } } },
  resolve: { alias: { '@': '/src' } },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } } },
});
