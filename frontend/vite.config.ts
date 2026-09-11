import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, '');
  // Voice emotion backend (../backend). Proxied so the browser talks to one
  // origin in dev and preview; no CORS setup needed locally.
  const backend = env.BACKEND_URL || 'http://127.0.0.1:8000';
  const proxy = {
    '/health': {target: backend, changeOrigin: true},
    '/predict': {target: backend, changeOrigin: true},
    '/chat': {target: backend, changeOrigin: true},
    '/ws': {target: backend, changeOrigin: true, ws: true},
    // Monitoring API (accounts, check-ins, counsellor dashboard)
    '/auth': {target: backend, changeOrigin: true},
    '^/me(/|$|\\?)': {target: backend, changeOrigin: true},   // not a plain '/me': it would catch /metadata.json
    '/questionnaires': {target: backend, changeOrigin: true},
    '/counsellor': {target: backend, changeOrigin: true},
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy,
    },
    preview: {
      proxy,
    },
  };
});
