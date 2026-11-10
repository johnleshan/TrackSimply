import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { mockPlugin } from './scripts/dev-mock-plugin.js'
import { writeGuardPlugin } from './scripts/dev-write-guard.js'
import { devApiPlugin } from './scripts/dev-api-plugin.js'

// Three ways to run the app, selected with --mode. The mock and guard plugins
// declare apply: 'serve', so none of them exists in a production build.
//
//   npm run dev:demo   fixtures from the dev server, writes allowed
//   npm run dev:live   the real database, writes blocked (safe browsing)
//   npm run dev        the real database, writes allowed (deliberate)
//
// The AI assistant goes through /api/assistant in every mode. Vercel runs the
// function in production; dev-api-plugin serves the same handler locally so the
// two cannot drift apart, and so the Groq key stays server-side even in dev.
export default defineConfig(({ mode }) => {
  // Empty prefix loads every variable, not just VITE_*. The Groq key
  // deliberately has no VITE_ prefix: Vite would inline it into the bundle and
  // it would be readable by anyone who loads the site.
  const env = loadEnv(mode, process.cwd(), '')

  const useMock = env.VITE_TRACKSIMPLY_MOCK === '1'
  const useGuard = env.VITE_TRACKSIMPLY_READONLY === '1'

  return {
    plugins: [
      react(),
      ...(useMock ? [mockPlugin()] : []),
      ...(useGuard ? [writeGuardPlugin()] : []),
      devApiPlugin({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL }),
    ],
    server: {
      host: true,
      port: 5173,
      // Auth0's callback URL is registered against a fixed origin. Refusing to
      // drift to another port turns a silent callback mismatch into an obvious
      // startup error.
      strictPort: true,
    },
  }
})
