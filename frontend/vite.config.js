// Vite config: dev proxy `/api` -> Express on :3000 so the React app
// can call `fetch('/api/sort-ticket')` without CORS in development.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE || '/api';

  // Strip a trailing `/api` (or `/api/`) to find the proxy upstream.
  const proxyTarget = apiBase.replace(/\/api\/?$/, '') || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});