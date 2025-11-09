import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 5173);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 5174);

export default defineConfig({
  plugins: [react()],
  server: {
    port: FRONTEND_PORT,
    proxy: {
      '/transcribe': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
      '/tts': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
