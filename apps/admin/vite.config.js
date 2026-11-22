import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // VITE_API_URL is baked into the bundle at build time. Without it the portal
  // silently calls http://localhost:5000 from users' browsers, so fail the
  // production build (e.g. on Vercel) instead of shipping a broken site.
  if (command === 'build' && mode === 'production') {
    const apiUrl = env.VITE_API_URL?.trim()
    if (!apiUrl) {
      throw new Error('VITE_API_URL is not set. Set it to your API URL including /api, e.g. https://civicfix-api.onrender.com/api')
    }
    if (!/^https?:\/\/.+\/api\/?$/.test(apiUrl)) {
      throw new Error(`VITE_API_URL must be a full URL ending in /api (got "${apiUrl}")`)
    }
  }

  return {
    plugins: [react()],
  }
})
