import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // From the shell or client/.env.local (git-ignored). No VITE_ prefix on the token on purpose:
  // only VITE_* values can reach browser code, and the token must stay in this dev proxy.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  // The API server: local (server/, `npm run dev`) by default, or e.g. the Railway URL.
  const api = env.VITE_API_TARGET ?? 'http://127.0.0.1:3000';
  // The server's API_TOKEN, added to every proxied request (required by the deployed server).
  const token = env.API_TOKEN;
  // Proxying keeps the UI and the reports on one origin, so reports can be embedded without CORS.
  const target = {
    target: api,
    changeOrigin: true,
    ...(token && { headers: { Authorization: `Bearer ${token}` } }),
  };
  return {
    plugins: [react()],
    // Don't wipe the terminal: `npm run dev` at the repo root shares it with the server.
    clearScreen: false,
    server: {
      port: 5173,
      proxy: { '/api': target, '/reports': target },
    },
    test: { globals: true, include: ['src/**/*.test.ts'] },
  };
});
