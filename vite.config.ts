import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const rawBasePath = process.env.VITE_BASE_PATH ?? '/'
const basePath = rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`
const assetsPathPrefix = `${basePath}assets/`

export default defineConfig({
  base: basePath,
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/mathjax-full/')) {
            return 'vendor-mathjax'
          }

          if (id.includes('node_modules/highlight.js/')) {
            return 'vendor-highlight'
          }

          if (
            id.includes('node_modules/@marp-team/marp-core/') ||
            id.includes('node_modules/@marp-team/marpit/') ||
            id.includes('node_modules/@marp-team/marpit-svg-polyfill/') ||
            id.includes('node_modules/katex/')
          ) {
            return 'vendor-marp'
          }

          if (
            id.includes('node_modules/@uiw/react-codemirror/') ||
            id.includes('node_modules/@uiw/codemirror-extensions-basic-setup/') ||
            id.includes('node_modules/@codemirror/') ||
            id.includes('node_modules/@lezer/') ||
            id.includes('node_modules/@marijn/find-cluster-break/') ||
            id.includes('node_modules/style-mod/') ||
            id.includes('node_modules/w3c-keyname/') ||
            id.includes('node_modules/crelt/')
          ) {
            return 'vendor-codemirror'
          }

          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react'
          }
        }
      }
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'MD Slides',
        short_name: 'MD Slides',
        description: 'Offline Markdown slide editor and preview powered by Marp.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: basePath,
        scope: basePath,
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.startsWith(assetsPathPrefix),
            handler: 'CacheFirst',
            options: {
              cacheName: 'md-slides-runtime-assets',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'md-slides-pages',
              networkTimeoutSeconds: 3
            }
          }
        ]
      }
    })
  ]
})
