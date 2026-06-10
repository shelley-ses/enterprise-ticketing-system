import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
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
