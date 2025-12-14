import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Note: Local frontend connects directly to production API (https://budget.tobiasbay.me/api)
  // This ensures both local and production frontends use the same backend and database
  // CORS is already configured in the backend to allow all origins
})
