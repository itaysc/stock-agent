import type { Deployment, PendingOrder } from './deployment.types.js';
import { bookFill } from './sleeve-ledger.js';

/** What the broker says about one of our orders (null: not found). */
export interface OrderStatus {
  status: string;
  filledQty: number;
  filledAvgPrice: number | null;
}

const DONE = new Set([
  'filled',
  'canceled',
  'expired',
  'rejected',
  'done_for_day',
  'replaced',
]);
const LOST_AFTER_MS = 2 * 86_400_000;

/**
 * Books new fills of the deployment's pending orders into their sleeves and
 * drops finished orders. Returns what happened, for the deployment's log.
 */
export async function reconcile(
  d: Deployment,
  getOrder: (clientOrderId: string) => Promise<OrderStatus | null>,
  now: Date,
): Promise<string[]> {
  const events: string[] = [];
  for (const ledger of d.ledgers) {
    const still: PendingOrder[] = [];
    for (const p of ledger.pending) {
      const order = await getOrder(p.clientOrderId);
      if (!order) {
        if (now.getTime() - new Date(p.submittedAt).getTime() > LOST_AFTER_MS) {
          events.push(
            `Gave up on ${p.side} ${p.qty} ${p.symbol}: the broker has no such order`,
          );
        } else still.push(p);
        continue;
      }
      const fresh = order.filledQty - p.bookedQty;
      if (fresh > 0 && order.filledAvgPrice !== null) {
        const trade = bookFill(ledger, {
          timestamp: now,
          symbol: p.symbol,
          side: p.side,
          qty: fresh,
          price: order.filledAvgPrice,
          reason: p.reason,
        });
        p.bookedQty = order.filledQty;
        const pnl =
          trade.realizedPnl === undefined
            ? ''
            : ` (P&L ${trade.realizedPnl >= 0 ? '+' : ''}$${trade.realizedPnl.toFixed(2)})`;
        events.push(
          `${p.side === 'buy' ? 'Bought' : 'Sold'} ${fresh} ${p.symbol} at $${order.filledAvgPrice.toFixed(2)}${pnl}`,
        );
      }
      if (DONE.has(order.status)) {
        if (p.bookedQty < p.qty)
          events.push(
            `${p.side} ${p.symbol}: ${order.status} after ${p.bookedQty} of ${p.qty}`,
          );
      } else {
        still.push(p);
      }
    }
    ledger.pending = still;
  }
  return events;
}
