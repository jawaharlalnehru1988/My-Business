import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'

// __dirname equivalent for ES modules. Used to resolve absolute paths
// for Vite's root / publicDir / outDir so the build is stable regardless
// of where npm is invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  // Default to local API Gateway (http://localhost:8089) published by Docker Compose.
  // Can be overridden in a git-ignored .env.local file: VITE_API_PROXY_TARGET=http://localhost:8080
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8089';

  return {
    root: path.resolve(__dirname, 'src'),
    publicDir: path.resolve(__dirname, 'public'),
    plugins: [
      react(),
    ],
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'pdf': ['jspdf', 'html2canvas'],
            'icons': ['lucide-react'],
            'qr': ['qrcode'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: apiTarget.startsWith('https'),
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: 4200,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: apiTarget.startsWith('https'),
        }
      }
    }
  }
})
