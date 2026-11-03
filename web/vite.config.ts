import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Allow jmd.localhost for multi-tenant local dev
    allowedHosts: ['jmd.localhost', 'localhost'],
  },
})
