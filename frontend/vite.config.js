import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const demo = loadEnv(mode, import.meta.dirname, 'GROCEREASE_')
  const tls = demo.GROCEREASE_TLS_CERT && demo.GROCEREASE_TLS_KEY
    ? { cert: readFileSync(demo.GROCEREASE_TLS_CERT), key: readFileSync(demo.GROCEREASE_TLS_KEY) } : undefined
  return {
  plugins: [react(),tailwindcss()],
  server: {
    https: tls,
    // With VITE_API_URL=/api, browser auth/API requests share the trusted HTTPS origin.
    proxy: { '/api': 'http://127.0.0.1:8000', '/sanctum': 'http://127.0.0.1:8000' },
  },
  }
})
