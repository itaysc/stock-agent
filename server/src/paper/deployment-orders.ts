import { randomUUID } from 'node:crypto';
import { type CycleDeps, logEvent } from './deployment-events.js';
import type { Runtime } from './deployment-runtime.js';
import type { Deployment } from './deployment.types.js';
import type { OrderRequest } from './sleeve-context.js';

/** Whether this deployment's buys wait for the pre-open news check. */
export const checksNews = (d: Deployment) =>
  !!d.newsCheck && (d.newsCheck.tone > 0 || d.newsCheck.ai);

/** Sends one market order for a sleeve (through the risk checks) and tracks it as pending. */
export async function placeOne(
  d: Deployment,
  sleeve: number,
  o: OrderRequest,
  deps: CycleDeps,
  now: Date,
  when = 'fills at the next open',
): Promise<void> {
  const clientOrderId = `dep-${d.id.slice(0, 8)}-${sleeve}-${o.symbol}-${randomUUID().slice(0, 8)}`;
  try {
    await deps.placeOrder({
      clientOrderId,
      symbol: o.symbol,
      side: o.side,
      qty: o.qty,
    });
    d.ledgers[sleeve].pending.push({
      ...o,
      clientOrderId,
      submittedAt: now,
      bookedQty: 0,
    });
    logEvent(
      d,
      `Sent ${o.side} ${o.qty} ${o.symbol}${o.reason ? ` (${o.reason})` : ''}: ${when}`,
      now,
    );
  } catch (err) {
    logEvent(
      d,
      `${o.side} ${o.qty} ${o.symbol} not sent: ${(err as Error).message}`,
      now,
    );
  }
}

/**
 * Sends the orders the strategies asked for, sells first. With news checks
 * on, buys wait (staged) for the pre-open check instead.
 */
export async function sendOrders(
  d: Deployment,
  runtime: Runtime,
  deps: CycleDeps,
  now: Date,
): Promise<void> {
  for (const [i, s] of runtime.sleeves.entries()) {
    const orders = s.context.orders
      .splice(0)
      .sort(
        (a, b) => (a.side === 'sell' ? -1 : 1) - (b.side === 'sell' ? -1 : 1),
      );
    for (const o of orders) {
      if (o.side === 'buy' && checksNews(d)) {
        (d.ledgers[i].staged ??= []).push({
          symbol: o.symbol,
          qty: o.qty,
          reason: o.reason,
          signalAt: now,
        });
        logEvent(
          d,
          `Buy ${o.qty} ${o.symbol}${o.reason ? ` (${o.reason})` : ''}: waiting for the news check before the open`,
          now,
        );
      } else {
        await placeOne(d, i, o, deps, now);
      }
    }
  }
}

/** Sends sell orders for every position of every sleeve (e.g. when stopping); drops waiting buys. */
export async function flatten(
  d: Deployment,
  runtime: Runtime,
  deps: CycleDeps,
  now: Date,
  reason: string,
): Promise<void> {
  runtime.sleeves.forEach((s, i) => {
    d.ledgers[i].staged = [];
    for (const p of Object.values(d.ledgers[i].positions)) {
      if (!d.ledgers[i].pending.some((o) => o.symbol === p.symbol)) {
        s.context.orders.push({
          symbol: p.symbol,
          side: 'sell',
          qty: p.qty,
          reason,
        });
      }
    }
  });
  await sendOrders(d, runtime, deps, now);
}
