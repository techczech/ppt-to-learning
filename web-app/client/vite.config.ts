import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        timeout: 300000, // 5 minutes for large uploads
      },
      '/media': 'http://localhost:3001',
      '/legacy-media': 'http://localhost:3001'
    }
  }
})
