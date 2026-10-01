import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API server (server/, `npm run dev`). Proxying keeps the UI and the
// reports on one origin, so reports can be embedded without CORS.
const api = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  // Don't wipe the terminal: `npm run dev` at the repo root shares it with the server.
  clearScreen: false,
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/reports': api,
    },
  },
  test: { globals: true, include: ['src/**/*.test.ts'] },
});
