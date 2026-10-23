import type { LedgerTrade } from '../paper/deployment.types.js';

/** A trade's New York day (YYYY-MM-DD), the day whose dollar rate applies. */
export const nyDay = (t: Date | string) =>
  new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/** The buys of the shares you hold now: those since the position was opened. */
export const openBuys = (
  trades: LedgerTrade[],
  symbol: string,
  openedAt: Date | null,
) =>
  trades.filter(
    (t) =>
      t.symbol === symbol &&
      t.side === 'buy' &&
      (!openedAt || new Date(t.timestamp) >= openedAt),
  );

/**
 * What the shares you hold cost in shekels: each buy at the dollar rate of
 * its own day, scaled to the shares still held (after partial sells). Null
 * when a buy day has no rate.
 */
export function paidInShekels(
  buys: Array<{ qty: number; price: number; timestamp: Date | string }>,
  held: number,
  rateOn: (day: string) => number | undefined,
): number | null {
  let ils = 0;
  let qty = 0;
  for (const b of buys) {
    const rate = rateOn(nyDay(b.timestamp));
    if (!rate) return null;
    ils += b.qty * b.price * rate;
    qty += b.qty;
  }
  return qty > 0 ? (ils * Math.min(held, qty)) / qty : null;
}
