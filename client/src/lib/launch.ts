import type { Page } from '../components/Header';

const PAGES: Page[] = ['broker', 'trade', 'tax', 'lab', 'paper', 'accounts'];

/**
 * What the address asked for when the app opened, read once (at load) and
 * then removed from the address: a page (home-screen shortcuts, coming back
 * from Alpaca), a message, or an Alpaca sign-in error.
 */
function read() {
  const q = new URLSearchParams(window.location.search);
  const page = q.get('page') as Page | null;
  const out = {
    page: page && PAGES.includes(page) ? page : null,
    notice: q.get('notice'),
    alpacaError: q.get('alpacaError'),
  };
  if (q.has('page') || q.has('notice') || q.has('alpacaError')) {
    ['page', 'notice', 'alpacaError'].forEach((k) => q.delete(k));
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }
  return out;
}

export const launch = read();
