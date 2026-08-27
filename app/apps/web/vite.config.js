import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Refuses to produce a production bundle that points at localhost.
 *
 * VITE_API_URL is baked in at build time, and when it is missing the app
 * falls back to http://localhost:4000 — correct for `vite dev`, useless
 * once deployed. That failure is invisible: the build succeeds, the site
 * serves, and every call fails in the visitor's browser against a host
 * only the developer has. This is exactly how the first kna-web deploy
 * shipped. Turning it into a build error makes it one line of output
 * instead of an afternoon in devtools.
 */
function requireApiUrlInProduction() {
  return {
    name: 'kna-require-api-url',
    apply: 'build',
    config(_config, { mode }) {
      if (mode !== 'production') return
      const url = process.env.VITE_API_URL
      if (!url) {
        throw new Error(
          'VITE_API_URL is not set, so this build would ship pointing at ' +
            'http://localhost:4000.\n' +
            '  On Render it is set on the kna-web service — see render.yaml.\n' +
            '  To build locally: VITE_API_URL=https://kna-api.onrender.com npm run build:web'
        )
      }
      if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(url)) {
        throw new Error(
          `VITE_API_URL points at localhost (${url}); refusing to build for production.`
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), requireApiUrlInProduction()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 20_000,
  },
})
