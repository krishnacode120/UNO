import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { resolveServerUrl } from './src/lib/server-url.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const serverUrl = resolveServerUrl(env.VITE_SERVER_URL, mode === 'vercel');
  if (mode === 'vercel' && serverUrl === null) {
    console.info('[vercel] Solo-only build. Set VITE_SERVER_URL and redeploy to enable multiplayer.');
  }
  return {
    define: { 'import.meta.env.VITE_SERVER_URL': JSON.stringify(serverUrl) },
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/socket.io': { target: 'http://127.0.0.1:4000', ws: true },
        '/api': { target: 'http://127.0.0.1:4000' }
      }
    },
    preview: {
      port: 4173
    }
  };
});
