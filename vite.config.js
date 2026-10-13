import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { mockPlugin } from './scripts/dev-mock-plugin.js'
import { writeGuardPlugin } from './scripts/dev-write-guard.js'

// Three ways to run the app, selected with --mode. The plugins are declared
// apply: 'serve', so none of them exists in a production build.
//
//   npm run dev:demo   fixtures from the dev server, writes allowed
//   npm run dev:live   the real database, writes blocked (safe browsing)
//   npm run dev        the real database, writes allowed (deliberate)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const useMock = env.VITE_TRACKSIMPLY_MOCK === '1'
  const useGuard = env.VITE_TRACKSIMPLY_READONLY === '1'

  return {
    plugins: [
      react(),
      ...(useMock ? [mockPlugin()] : []),
      ...(useGuard ? [writeGuardPlugin()] : []),
    ],
    server: {
      host: true,
      port: 5173,
    },
  }
})