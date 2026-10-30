import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The sandbox preview proxies the app under a generated host, so we must
    // not restrict allowedHosts. Keeping the dev server open is safe here
    // because it only serves public, static frontend assets.
    allowedHosts: true,
    proxy: {
      // Local dev parity with Vercel: /api/* is served by the Python
      // extraction service when it is running locally.
      '/api': {
        target: process.env.EXTRACT_DEV_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
