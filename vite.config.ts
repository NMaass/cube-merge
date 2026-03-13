import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/bundle-analyzer.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
    proxy: {
      '/cubecobra': {
        target: 'https://cubecobra.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cubecobra/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Keep monitoring async so it doesn't inflate the startup path.
          if (id.includes('@sentry')) return 'sentry'
          if (id.includes('web-vitals')) return 'web-vitals'
          if (id.includes('firebase/firestore/lite')) return 'firebase-lite'
          if (id.includes('@firebase/firestore/dist/lite')) return 'firebase-lite'
          if (id.includes('/src/lib/firebase-lite.ts')) return 'firebase-lite'
          // Firebase bundle
          if (id.includes('firebase')) return 'firebase'
          // Core React libraries
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor'
          // UI components
          if (id.includes('/components/ui/') || id.includes('/components/cards/')) return 'ui'
          // Node modules
          if (id.includes('node_modules')) return 'vendor'
          // Return undefined for app code to use default chunking
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || []
          let extType = info[info.length - 1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img'
          }
          return `assets/${extType}/[name]-[hash][extname]`
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: 'hidden',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 500, // Lower threshold for better chunking
    modulePreload: {
      polyfill: false // Disable polyfill for faster loading
    },
  },
})
