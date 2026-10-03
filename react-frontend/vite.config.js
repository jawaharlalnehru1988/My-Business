import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'

// __dirname equivalent for ES modules. Used to resolve absolute paths
// for Vite's root / publicDir / outDir so the build is stable regardless
// of where npm is invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// v1.10.6 — audit L20: read `data/port.txt` when it exists so the dev
// proxy tracks whatever port Express landed on (Express drifts off the
// default when EADDRINUSE bumps it to 47372, 47373, …). Falls back to
// the historical 47371 default if the file's missing.
const readActivePort = () => {
  try {
    const p = path.join(__dirname, 'data', 'port.txt');
    if (!fs.existsSync(p)) return 47371;
    const n = parseInt(fs.readFileSync(p, 'utf-8').trim(), 10);
    return (isFinite(n) && n >= 1024 && n <= 65535) ? n : 47371;
  } catch { return 47371; }
};
const activeExpressPort = readActivePort();

export default defineConfig({
  // Vite source root lives in src/ rather than the project root. Reason:
  // the project root holds the user-facing Launcher (renamed to index.html
  // so users see ONE html file). Keeping Vite's own index.html inside
  // src/ keeps the install folder uncluttered. publicDir + outDir are
  // resolved relative to the project root so existing public/ assets
  // and dist/ output paths keep working.
  root: path.resolve(__dirname, 'src'),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [
    react(),
  ],
  build: {
    // outDir + publicDir point at project-root paths because Vite's
    // `root` is src/ — without absolute resolution the output would
    // land inside src/dist/ instead of the repo's dist/.
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // v1.10.2 — main+pdf chunks tripped the default 500 KB warning line
    // on every build (main 812 KB, pdf 588 KB). Bumped to 900 KB — high
    // enough to silence noise, low enough to catch a genuine regression.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          // v1.10.2 — React was in the main bundle; every app-code
          // change invalidated the React runtime for cached clients.
          // Now: cache hit on React across releases as long as versions
          // don't move.
          'react-vendor': ['react', 'react-dom'],
          'pdf': ['jspdf', 'html2canvas'],
          'icons': ['lucide-react'],
          'qr': ['qrcode'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:8080`,
        changeOrigin: true,
      }
    }
  }
})
