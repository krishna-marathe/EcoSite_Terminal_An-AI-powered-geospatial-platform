import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The dev proxy target is server-side configuration, so it is not exposed to
  // the browser. It stays overridable because port 8000 is often occupied by
  // another local service; point ECOSITE_API_PROXY_TARGET at the real backend.
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    env.ECOSITE_API_PROXY_TARGET || env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': proxyTarget,
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
