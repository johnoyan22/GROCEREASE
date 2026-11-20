import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const demo = loadEnv(mode, import.meta.dirname, 'GROCEREASE_')
  const tls = demo.GROCEREASE_TLS_CERT && demo.GROCEREASE_TLS_KEY
    ? { cert: readFileSync(demo.GROCEREASE_TLS_CERT), key: readFileSync(demo.GROCEREASE_TLS_KEY) } : undefined
  const demoHost = (demo.GROCEREASE_DEMO_HOST || '').toLowerCase()
  if (demoHost && (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(demoHost) || demoHost.includes('..'))) {
    throw new Error('GROCEREASE_DEMO_HOST must be one exact hostname without a scheme, port, wildcard or path.')
  }
  const proxy = () => ({
    target: 'http://127.0.0.1:8000',
    configure(server) {
      server.on('proxyReq', (outgoing, request) => {
        const remote = request.socket.remoteAddress
        const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
        const tunnel = demoHost && request.headers.host?.toLowerCase() === demoHost && loopback
        const https = Boolean(request.socket.encrypted || tunnel)
        // Overwrite spoofable forwarding headers. Trust HTTPS only at our TLS listener
        // or the explicitly configured local ngrok -> Vite hop, not arbitrary clients.
        outgoing.setHeader('X-Forwarded-Proto', https ? 'https' : 'http')
        outgoing.setHeader('X-Forwarded-Host', request.headers.host || 'localhost:5173')
        outgoing.setHeader('X-Forwarded-Port', tunnel ? '443' : String(new URL((https ? 'https://' : 'http://')+(request.headers.host || 'localhost:5173')).port || (https ? '443' : '80')))
        outgoing.setHeader('X-Forwarded-For', remote || '127.0.0.1')
        outgoing.removeHeader('Forwarded')
      })
    },
  })
  return {
  plugins: [react(),tailwindcss()],
  server: {
    https: tls,
    allowedHosts: demoHost ? [demoHost] : [],
    // Verification links must reach Laravel on the same origin as the session cookie.
    proxy: { '/api': proxy(), '/sanctum': proxy(), '/email/verify': proxy() },
  },
  }
})
