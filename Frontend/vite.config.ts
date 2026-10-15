import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@localo/types': path.resolve(__dirname, '../packages/types/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    headers: {
      // Google Identity Services needs the opener relationship for its popup flow.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/v1': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/uploads': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
