import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // expose on LAN so the app can be opened from a phone during development
    proxy: { '/api': 'http://localhost:3001' },
    fs: { allow: ['..'] }, // lets the client import ../shared/edc.ts
  },
  build: {
    chunkSizeWarningLimit: 1500, // three.js is large by nature; split it into its own chunk below
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) only accepts the function form here.
        manualChunks: (id) => (/node_modules\/(three|@react-three)\//.test(id) ? 'three' : undefined),
      },
    },
  },
});
