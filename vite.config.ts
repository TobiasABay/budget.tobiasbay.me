import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // In dev, `/api` is same-origin and proxied to production so LAN URLs (e.g. 192.168.x) avoid CORS.
  // Override with VITE_API_URL if needed. Production build uses relative `/api` on the same host.
  server: {
    proxy: {
      '/api': {
        target: 'https://budget.tobiasbay.me',
        changeOrigin: true,
      },
    },
  },
})
