import type { SyncChange, SyncResult } from '../api/trade-types';

const shares = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));
const list = (cs: SyncChange[]) => cs.map((c) => `${shares(c.qty)} ${c.symbol}`).join(', ');

/** One line on what a sync with Alpaca changed. */
export function syncSummary(r: SyncResult): string {
  const parts = [
    r.added.length ? `added ${list(r.added)} (bought outside the app)` : '',
    r.removed.length ? `lowered ${list(r.removed)} (sold outside the app)` : '',
    r.orders
      ? `following ${r.orders} open order${r.orders > 1 ? 's' : ''} placed outside the app`
      : '',
    r.skipped.length ? `${r.skipped.join(', ')} waits for its order to finish` : '',
  ].filter(Boolean);
  return parts.length
    ? `Synced with Alpaca: ${parts.join('; ')}.`
    : 'Already in sync with Alpaca: nothing to change.';
}
