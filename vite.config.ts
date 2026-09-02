import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Locked URL for browser homepage: http://127.0.0.1:5173/ */
const HOST = '127.0.0.1'
const PORT = 5173

/** GitHub Pages serves from /task-inbox/ — set in the deploy workflow */
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: HOST,
    port: PORT,
    strictPort: true,
  },
  preview: {
    host: HOST,
    port: PORT,
    strictPort: true,
  },
})
