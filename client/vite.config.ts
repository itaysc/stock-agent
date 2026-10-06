import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * On build, Netlify's _redirects file: /api and /reports go to the server
 * (Netlify proxies them, so the browser sees one site and the login cookie
 * works without CORS), and any other path to the app.
 */
const netlifyRedirects = (api: string | undefined): Plugin => ({
  name: 'netlify-redirects',
  apply: 'build',
  generateBundle() {
    if (!api) this.warn('API_URL is not set: the built site has no server to call');
    const forward = api
      ? ['/api/*', '/reports/*'].map((p) => `${p}  ${api}${p.replace('*', ':splat')}  200`)
      : [];
    this.emitFile({
      type: 'asset',
      fileName: '_redirects',
      source: [...forward, '/*  /index.html  200', ''].join('\n'),
    });
  },
});

export default defineConfig(({ mode }) => {
  // From the shell, or client/.env (git-ignored; see .env.example). Values without the VITE_ prefix
  // never reach browser code: the browser only ever calls /api on its own site.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  // The API server: the local one (server/, `npm run dev`) by default, or e.g. the Railway URL.
  const apiUrl = env.API_URL?.replace(/\/+$/, '');
  const api = apiUrl ?? 'http://127.0.0.1:3000';
  // The server's API_TOKEN, added to every proxied request (required by the deployed server).
  const token = env.API_TOKEN;
  // Proxying keeps the UI and the reports on one origin, so reports can be embedded without CORS.
  const target = {
    target: api,
    changeOrigin: true,
    ...(token && { headers: { Authorization: `Bearer ${token}` } }),
  };
  return {
    plugins: [react(), netlifyRedirects(apiUrl)],
    // Don't wipe the terminal: `npm run dev` at the repo root shares it with the server.
    clearScreen: false,
    server: {
      port: 5173,
      proxy: { '/api': target, '/reports': target },
    },
    test: { globals: true, include: ['src/**/*.test.ts'] },
  };
});
