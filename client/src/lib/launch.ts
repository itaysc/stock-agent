import type { Page } from '../components/Header';

const PAGES: Page[] = ['broker', 'trade', 'tax', 'lab', 'paper', 'accounts'];

/**
 * What the address asked for when the app opened, read once (at load) and
 * then removed from the address: a page (home-screen shortcuts, coming back
 * from Alpaca), a message, or a sign-in error (Alpaca or Google).
 */
function read() {
  const q = new URLSearchParams(window.location.search);
  const page = q.get('page') as Page | null;
  const out = {
    page: page && PAGES.includes(page) ? page : null,
    notice: q.get('notice'),
    alpacaError: q.get('alpacaError'),
    authError: q.get('authError'),
  };
  const keys = ['page', 'notice', 'alpacaError', 'authError'];
  if (keys.some((k) => q.has(k))) {
    keys.forEach((k) => q.delete(k));
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }
  return out;
}

export const launch = read();
