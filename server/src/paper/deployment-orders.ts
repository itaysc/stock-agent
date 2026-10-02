import { randomUUID } from 'node:crypto';
import { type CycleDeps, logEvent } from './deployment-events.js';
import type { Runtime } from './deployment-runtime.js';
import type { Deployment } from './deployment.types.js';
import type { OrderRequest } from './sleeve-context.js';

/** Whether this deployment's buys wait for the pre-open news check. */
export const checksNews = (d: Deployment) =>
  !!d.newsCheck && (d.newsCheck.tone > 0 || d.newsCheck.ai);

/**
 * Sends the order; a fractional amount of a stock the broker can't trade in
 * fractions goes out as whole shares instead. Returns the quantity sent.
 */
async function sendQty(
  o: OrderRequest,
  clientOrderId: string,
  deps: CycleDeps,
): Promise<{ qty: number; clientOrderId: string }> {
  const send = (qty: number, id: string) =>
    deps.placeOrder({ clientOrderId: id, symbol: o.symbol, side: o.side, qty });
  try {
    await send(o.qty, clientOrderId);
    return { qty: o.qty, clientOrderId };
  } catch (err) {
    const whole = Math.floor(o.qty);
    if (
      Number.isInteger(o.qty) ||
      whole < 1 ||
      !/fraction/i.test((err as Error).message)
    )
      throw err;
    // A new id: the order log already has the refused one.
    await send(whole, `${clientOrderId}w`);
    return { qty: whole, clientOrderId: `${clientOrderId}w` };
  }
}

/** Sends one market order for a sleeve (through the risk checks) and tracks it as pending. */
export async function placeOne(
  d: Deployment,
  sleeve: number,
  o: OrderRequest,
  deps: CycleDeps,
  now: Date,
  when = 'fills at the next open',
): Promise<void> {
  const id = `dep-${d.id.slice(0, 8)}-${sleeve}-${o.symbol}-${randomUUID().slice(0, 8)}`;
  try {
    const { qty, clientOrderId } = await sendQty(o, id, deps);
    o = { ...o, qty };
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
    if (/wash trade/i.test((err as Error).message)) {
      (d.ledgers[sleeve].retry ??= []).push(o);
      logEvent(
        d,
        `${o.side} ${o.qty} ${o.symbol} waits: another investment has an opposite order open on it; sent again once that one fills`,
        now,
      );
      return;
    }
    logEvent(
      d,
      `${o.side} ${o.qty} ${o.symbol} not sent: ${(err as Error).message}`,
      now,
    );
  }
}

/** Sends the orders that waited for an opposite order of another investment (while the market is open or about to). */
export async function retryOrders(
  d: Deployment,
  deps: CycleDeps,
  now: Date,
): Promise<void> {
  if (!d.ledgers.some((l) => l.retry?.length) || !(await deps.opensSoon()))
    return;
  for (const [i, l] of d.ledgers.entries()) {
    const waiting = l.retry ?? [];
    l.retry = [];
    for (const o of waiting)
      if (!l.pending.some((p) => p.symbol === o.symbol))
        await placeOne(
          d,
          i,
          o,
          deps,
          now,
          "sent after the other investment's order",
        );
      else l.retry.push(o);
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
