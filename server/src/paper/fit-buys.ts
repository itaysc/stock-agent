import { roundQty } from '../strategies/qty.js';
import type { SleeveLedger } from './deployment.types.js';
import type { OrderRequest } from './sleeve-context.js';

/** Whole-share buys are sized at the last close but fill at the next open: room for it opening this much higher. */
export const OPEN_GAP = 0.01;

/**
 * Shrinks a batch's buys (all by the same share) so they fit the sleeve's
 * cash: its cash, plus what this batch's sells bring, minus buys already on
 * the way (whole shares with OPEN_GAP to spare). Without it, the strategy
 * could ask for more than the investment has (its cash goes below zero).
 */
export function fitBuys(
  ledger: SleeveLedger,
  orders: OrderRequest[],
): OrderRequest[] {
  const price = (s: string) => ledger.lastPrices[s] ?? 0;
  const cost = (list: Array<{ symbol: string; qty: number }>) =>
    list.reduce((n, o) => n + o.qty * price(o.symbol), 0);
  // Fractional buys go out as dollar amounts (they spend exactly that); whole shares need the room.
  const need = orders
    .filter((o) => o.side === 'buy')
    .reduce(
      (n, o) =>
        n +
        o.qty * price(o.symbol) * (Number.isInteger(o.qty) ? 1 + OPEN_GAP : 1),
      0,
    );
  if (!(need > 0)) return orders;
  const pendingBuys = ledger.pending
    .filter((p) => p.side === 'buy')
    .map((p) => ({ symbol: p.symbol, qty: p.qty - p.bookedQty }));
  const available =
    ledger.cash +
    cost(orders.filter((o) => o.side === 'sell')) -
    cost(pendingBuys) -
    cost(ledger.staged ?? []);
  if (need <= available) return orders;
  const scale = Math.max(0, available / need);
  return orders.flatMap((o) => {
    if (o.side === 'sell') return [o];
    const qty = roundQty(o.qty * scale, !Number.isInteger(o.qty));
    return qty > 0 ? [{ ...o, qty }] : [];
  });
}
