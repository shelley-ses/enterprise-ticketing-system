import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/ticketing/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5005,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/api/ticketing/customer': {
        target: process.env.VITE_CUSTOMER_SERVICE_URL || 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ticketing\/customer/, '/api')
      },
      '/api/ticketing/ticket': {
        target: process.env.VITE_TICKET_SERVICE_URL || 'http://127.0.0.1:8002',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ticketing\/ticket/, '/api')
      },
      '/api/ticketing/attachment': {
        target: process.env.VITE_ATTACHMENT_SERVICE_URL || 'http://127.0.0.1:8006',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ticketing\/attachment/, '/api')
      },
      '/api/ticketing/messaging': {
        target: process.env.VITE_MESSAGING_SERVICE_URL || 'http://127.0.0.1:8007',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ticketing\/messaging/, '/api')
      },
      '/storage': {
        target: process.env.VITE_ATTACHMENT_SERVICE_URL || 'http://127.0.0.1:8006',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Ensure these packages are pre-bundled / not externalized by Vite
  optimizeDeps: {
    include: ['laravel-echo', 'pusher-js'],
  },
  ssr: {
    noExternal: ['laravel-echo', 'pusher-js'],
  },
})
