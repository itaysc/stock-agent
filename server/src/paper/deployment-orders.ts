import { randomUUID } from 'node:crypto';
import { type CycleDeps, logEvent } from './deployment-events.js';
import type { Runtime } from './deployment-runtime.js';
import type { Deployment } from './deployment.types.js';
import { fitBuys } from './fit-buys.js';
import type { OrderRequest } from './sleeve-context.js';

/** Whether this deployment's buys wait for the pre-open news check. */
export const checksNews = (d: Deployment) =>
  !!d.newsCheck && (d.newsCheck.tone > 0 || d.newsCheck.ai);

const cents = (n: number) => Math.floor(n * 100) / 100;
const short = (err: unknown) =>
  /insufficient|buying power/i.test((err as Error).message);

interface Sent {
  qty: number;
  notional?: number;
  clientOrderId: string;
}

/**
 * Sends the order. A fractional buy goes out as a dollar amount (qty × the
 * last close): it fills at the open for exactly that, so a higher open can't
 * spend more than the investment has. A stock the broker can't trade in
 * fractions goes out as whole shares. When the account is short of cash, it
 * buys what the cash allows instead.
 */
async function send(
  o: OrderRequest,
  id: string,
  price: number,
  deps: CycleDeps,
): Promise<Sent> {
  const base = { clientOrderId: id, symbol: o.symbol, side: o.side };
  const asAmount = o.side === 'buy' && !Number.isInteger(o.qty) && price > 0;
  try {
    if (asAmount) {
      const notional = cents(o.qty * price);
      await deps.placeOrder({ ...base, notional });
      return { qty: o.qty, notional, clientOrderId: id };
    }
    await deps.placeOrder({ ...base, qty: o.qty });
    return { qty: o.qty, clientOrderId: id };
  } catch (err) {
    if (o.side === 'buy' && short(err))
      return sendWhatFits(o, id, price, deps, err);
    const whole = Math.floor(o.qty);
    if (
      Number.isInteger(o.qty) ||
      whole < 1 ||
      !/fraction/i.test((err as Error).message)
    )
      throw err;
    // A new id: the order log already has the refused one.
    await deps.placeOrder({ ...base, clientOrderId: `${id}w`, qty: whole });
    return { qty: whole, clientOrderId: `${id}w` };
  }
}

/** The buy, shrunk to the account's cash now (1% left for a higher open on whole shares). */
async function sendWhatFits(
  o: OrderRequest,
  id: string,
  price: number,
  deps: CycleDeps,
  refusal: unknown,
): Promise<Sent> {
  const cash = await deps.cashToBuy();
  const clientOrderId = `${id}c`;
  const base = { clientOrderId, symbol: o.symbol, side: o.side };
  if (!Number.isInteger(o.qty) && price > 0) {
    const notional = cents(Math.min(cash, o.qty * price));
    if (notional < 1) throw refusal;
    await deps.placeOrder({ ...base, notional });
    return { qty: notional / price, notional, clientOrderId };
  }
  const qty = price > 0 ? Math.floor(cash / (price * 1.01)) : 0;
  if (qty < 1 || qty >= o.qty) throw refusal;
  await deps.placeOrder({ ...base, qty });
  return { qty, clientOrderId };
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
    const price = d.ledgers[sleeve].lastPrices[o.symbol] ?? 0;
    const sent = await send(o, id, price, deps);
    o = { ...o, qty: sent.qty };
    d.ledgers[sleeve].pending.push({
      ...o,
      clientOrderId: sent.clientOrderId,
      submittedAt: now,
      bookedQty: 0,
      ...(sent.notional === undefined ? {} : { notional: sent.notional }),
    });
    const what =
      sent.notional === undefined
        ? `${o.qty} ${o.symbol}`
        : `$${sent.notional.toFixed(2)} of ${o.symbol}`;
    logEvent(
      d,
      `Sent ${o.side} ${what}${o.reason ? ` (${o.reason})` : ''}: ${when}`,
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
    // Buys only up to the cash it has (they fill at the open, often above the close they were sized at).
    const orders = fitBuys(d.ledgers[i], s.context.orders.splice(0)).sort(
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
