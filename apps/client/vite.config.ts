import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
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
});
