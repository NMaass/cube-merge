import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { execSync } from 'child_process'
import fs from 'fs'

function gitRun(cmd: string, fallback = 'unknown'): string {
  try { return execSync(cmd, { encoding: 'utf8' }).trim() } catch { return fallback }
}

function buildInfoPlugin() {
  return {
    name: 'build-info',
    buildStart() {
      const commitHash = gitRun('git rev-parse HEAD')
      const shortHash = gitRun('git rev-parse --short HEAD')
      const branch = gitRun('git rev-parse --abbrev-ref HEAD')
      const isDirty = gitRun('git status --porcelain') !== ''
      const now = new Date()
      const info = {
        version: '1.0.0',
        environment: process.env.CF_PAGES_BRANCH === 'main' ? 'production'
          : process.env.CF_PAGES_BRANCH ? 'staging'
          : process.env.CI ? 'ci'
          : 'development',
        git: { branch, commitHash, shortHash, isDirty },
        timestamp: {
          iso: now.toISOString(),
          unix: Math.floor(now.getTime() / 1000),
          formatted: {
            utc: now.toUTCString(),
            est: now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
            pst: now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
          },
        },
        builder: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      }
      fs.writeFileSync(
        path.resolve(__dirname, 'public/build-info.json'),
        JSON.stringify(info, null, 2)
      )
    },
  }
}

export default defineConfig({
  plugins: [
    buildInfoPlugin(),
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
