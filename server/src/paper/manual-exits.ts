import { type CycleDeps, logEvent } from './deployment-events.js';
import { placeOne } from './deployment-orders.js';
import type { Runtime } from './deployment-runtime.js';
import type { Deployment } from './deployment.types.js';

const DAY_MS = 86_400_000;
/** After you sell a stock (or your levels do), the strategy leaves it alone this long. */
export const NO_BUY_DAYS = 30;

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Keeps the strategy from buying `symbol` again for NO_BUY_DAYS. */
export function holdOff(d: Deployment, symbol: string, now: Date): void {
  (d.noBuyUntil ??= {})[symbol] = new Date(
    now.getTime() + NO_BUY_DAYS * DAY_MS,
  );
}

/** Whether the strategy may buy `symbol` now. */
export function mayBuy(d: Deployment, symbol: string, now: Date): boolean {
  const until = d.noBuyUntil?.[symbol];
  return !until || new Date(until) <= now;
}

/**
 * After a new close: sells a holding whose close crossed your own stop loss
 * or profit target (and drops the strategy's orders for it), then holds off
 * buying it again.
 */
export async function manualExits(
  d: Deployment,
  runtime: Runtime,
  deps: CycleDeps,
  now: Date,
): Promise<void> {
  for (const [i, ledger] of d.ledgers.entries()) {
    for (const p of Object.values(ledger.positions)) {
      const levels = d.manual?.[p.symbol];
      const close = ledger.lastPrices[p.symbol];
      if (!levels || close === undefined) continue;
      const stop = levels.stopPrice ?? null;
      const take = levels.takeProfitPrice ?? null;
      const why =
        stop !== null && close <= stop
          ? `your stop loss (${usd(stop)}): closed at ${usd(close)}`
          : take !== null && close >= take
            ? `your profit target (${usd(take)}): closed at ${usd(close)}`
            : null;
      if (!why || ledger.pending.some((o) => o.symbol === p.symbol)) continue;
      const context = runtime.sleeves[i]?.context;
      if (context)
        context.orders.splice(
          0,
          context.orders.length,
          ...context.orders.filter((o) => o.symbol !== p.symbol),
        );
      await placeOne(
        d,
        i,
        { symbol: p.symbol, side: 'sell', qty: p.qty, reason: why },
        deps,
        now,
        'fills at the next open',
      );
      delete d.manual?.[p.symbol];
      holdOff(d, p.symbol, now);
    }
  }
}

/** Drops buys of symbols you sold by hand (their money stays in cash). */
export function dropHeldOffBuys(
  d: Deployment,
  runtime: Runtime,
  now: Date,
): void {
  for (const s of runtime.sleeves) {
    const keep = s.context.orders.filter(
      (o) => o.side !== 'buy' || mayBuy(d, o.symbol, now),
    );
    for (const o of s.context.orders.filter((x) => !keep.includes(x)))
      logEvent(
        d,
        `Did not buy ${o.symbol}: you sold it, so it waits until ${new Date(d.noBuyUntil?.[o.symbol] ?? now).toDateString()}`,
        now,
      );
    s.context.orders.splice(0, s.context.orders.length, ...keep);
  }
}
