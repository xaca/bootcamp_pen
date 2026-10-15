import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect } from 'vite'

// /p/:slug is served by the lightweight published.html entry (same rewrite as firebase.json).
const publishedRewrite: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url?.startsWith('/p/')) req.url = '/published.html'
  next()
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'published-rewrite',
      configureServer: (server) => void server.middlewares.use(publishedRewrite),
      configurePreviewServer: (server) => void server.middlewares.use(publishedRewrite),
    },
  ],
  // Pre-bundle every Firebase entry together. Otherwise Vite discovers firebase/auth later
  // (lazy routes), re-bundles, and two copies of @firebase/app break auth in dev.
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/app-check',
      'firebase/auth',
      'firebase/firestore',
      'firebase/firestore/lite',
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        published: fileURLToPath(new URL('./published.html', import.meta.url)),
      },
    },
  },
})
