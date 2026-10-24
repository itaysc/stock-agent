/**
 * The app as an installed PWA: the service worker (built app only), the
 * "new version" notice, and installing it (Android/desktop prompt, iPhone steps).
 */

/** Fired when a new version is ready (the app shows the update notice). */
export const UPDATE_READY = 'pwa:update-ready';
/** Fired when installing becomes possible or is done. */
export const INSTALL_CHANGED = 'pwa:install-changed';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let waiting: ServiceWorker | null = null;
let installPrompt: InstallPrompt | null = null;

export function registerPwa(): void {
  // The browser offers installing once: keep the offer for the "Install app" button.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPrompt;
    window.dispatchEvent(new Event(INSTALL_CHANGED));
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    window.dispatchEvent(new Event(INSTALL_CHANGED));
  });
  // Only the built app has a service worker (in development it would serve stale files).
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      const ready = (w: ServiceWorker | null) => {
        // A first install isn't an update: only when it replaces a running version.
        if (!w || !navigator.serviceWorker.controller) return;
        waiting = w;
        window.dispatchEvent(new Event(UPDATE_READY));
      };
      ready(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => w.state === 'installed' && ready(w));
      });
      // Look for a new version every hour while the app stays open.
      setInterval(() => void reg.update(), 60 * 60_000);
    });
    // The new version took over: reload once to run it.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

/** Switches to the new version (the page reloads). */
export function applyUpdate(): void {
  waiting?.postMessage('skip-waiting');
}

/** Opened from the home screen (or installed desktop app). */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad Safari: no install prompt, the user adds it from the Share menu. */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();

export const canPrompt = () => installPrompt !== null;

/** Shows the browser's install prompt; true if installed. */
export async function promptInstall(): Promise<boolean> {
  if (!installPrompt) return false;
  await installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  window.dispatchEvent(new Event(INSTALL_CHANGED));
  return outcome === 'accepted';
}
