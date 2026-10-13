import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { mockPlugin } from './scripts/dev-mock-plugin.js'

// Demo mode is selected with `vite --mode demo`, which loads .env.demo and sets
// VITE_TRACKSIMPLY_MOCK=1. It serves fixture data from the dev server instead
// of contacting a Supabase project.
//
// The plugin declares `apply: 'serve'`, so it is excluded from `vite build`
// entirely and cannot reach production.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const useMock = env.VITE_TRACKSIMPLY_MOCK === '1'

  return {
    plugins: [
      react(),
      ...(useMock ? [mockPlugin()] : []),
    ],
    server: {
      host: true,
      port: 5173,
    },
  }
})