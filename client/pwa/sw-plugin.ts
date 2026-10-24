import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/**
 * On build, writes sw.js (the service worker) from pwa/sw-template.js with
 * every file of this build to save for offline, and a version that changes
 * when any of them does (so phones pick up the new app).
 */
export const serviceWorker = (): Plugin => ({
  name: 'bullwether-sw',
  apply: 'build',
  generateBundle(_options, bundle) {
    const built = Object.keys(bundle)
      .filter((f) => !f.endsWith('.map') && f !== '_redirects')
      .map((f) => `/${f}`);
    const files = [
      '/index.html',
      '/manifest.webmanifest',
      '/icon.svg',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/apple-touch-icon.png',
      ...built.filter((f) => f !== '/index.html'),
    ];
    const version = createHash('sha256')
      .update(
        Object.values(bundle)
          .map((b) => (b.type === 'chunk' ? b.code : String(b.source)))
          .join('\n'),
      )
      .digest('hex')
      .slice(0, 12);
    const source = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8')
      .replace('__VERSION__', version)
      .replace('__PRECACHE__', JSON.stringify(files, null, 2));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
});
