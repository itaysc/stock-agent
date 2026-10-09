import { infoNeeds } from '../strategies/rules/rules-validate.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import type { Deployment } from './deployment.types.js';
import {
  feed,
  type Runtime,
  symbolsToFetch,
  warmupDays,
} from './deployment-runtime.js';
import { type CycleDeps, logEvent } from './deployment-events.js';
import { reconcile } from './reconcile.js';
import {
  flatten,
  placeOne,
  sendOrders,
  retryOrders,
} from './deployment-orders.js';
import { step } from './cycle-step.js';
import { drawdownAlert } from './drawdown-alert.js';
import { watchEarnings } from './earnings-check.js';
import { dropHeldOffBuys, manualExits } from './manual-exits.js';
import { releaseStaged, watchHeld } from './news-check.js';
import { ledgerEquity } from './sleeve-ledger.js';

export type { CycleDeps } from './deployment-events.js';

type Bars = Record<string, StrategyBar[]>;
const DAY_MS = 86_400_000;

export const deploymentEquity = (d: Deployment) =>
  d.ledgers.reduce((n, l) => n + ledgerEquity(l), 0) + reserveOf(d);

/**
 * Money a deployment still holds uninvested: its sleeves' cash (including buys
 * planned or sent but not filled yet) and its reserve. The account's cash minus
 * this, for every live deployment, is what is free to invest.
 */
export const reservedCash = (d: Deployment) =>
  d.ledgers.reduce((n, l) => n + l.cash, 0) + reserveOf(d);

/**
 * The cash a deployment keeps out of the free cash: its reservedCash, or 0
 * when that is negative (a buy cost more than its cash and the free cash
 * covered it: that money already left the account, so it can't be counted
 * as free again until the deployment sells and pays it back).
 */
export const heldCash = (d: Deployment) => Math.max(0, reservedCash(d));

/** The part of the capital no sleeve got (kept in cash). */
export const reserveOf = (d: Deployment) =>
  d.capital -
  d.sleeves.reduce((n, s) => n + (d.capital * s.weightPct) / 100, 0);

/**
 * One pass of the daily cycle: book fills, feed newly completed daily bars
 * (orders only on the latest one), send the orders, save an equity snapshot
 * and check the drawdown guard.
 */
export async function runCycle(
  d: Deployment,
  runtime: Runtime,
  deps: CycleDeps,
): Promise<void> {
  const now = deps.now();
  const booked = await step(
    'checking orders',
    reconcile(d, (id) => deps.getOrder(id), now),
  );
  for (const message of booked) logEvent(d, message, now);
  if (d.status === 'stopped') return;

  const cutoff = await step('reading the market clock', deps.completedBefore());
  const { traded, market } = symbolsToFetch(runtime);
  const since =
    runtime.warmed && d.lastBarAt
      ? new Date(d.lastBarAt)
      : new Date(
          (d.lastBarAt ?? cutoff).valueOf() - warmupDays(runtime) * DAY_MS,
        );
  // Market data (e.g. SPY) never needs news or earnings; traded symbols may.
  const needs = d.sleeves.map((s) => infoNeeds([s.strategy], s.params));
  const all = {
    ...(market.length
      ? await step('fetching prices', deps.fetchDaily(market, since, cutoff))
      : {}),
    ...(await step(
      'fetching prices',
      deps.fetchDaily(traded, since, cutoff, {
        news: needs.some((n) => n.news),
        earnings: needs.some((n) => n.earnings),
      }),
    )),
  };
  const pick = (symbols: string[]) =>
    Object.fromEntries(
      symbols.map((s) => [
        s,
        (all[s] ?? []).filter((b) => b.timestamp < cutoff),
      ]),
    );
  const bars = pick(traded);
  const marketBars = pick(market);
  const latest = Math.max(
    0,
    ...Object.values(bars)
      .flat()
      .map((b) => b.timestamp.getTime()),
  );
  const last = d.lastBarAt ? new Date(d.lastBarAt).getTime() : null;

  if (!runtime.warmed) {
    // Replay history without orders. A new deployment then acts on the latest
    // completed day right away (orders for the next open), like its plan did.
    const previous = Math.max(
      0,
      ...Object.values(bars)
        .flat()
        .map((b) => b.timestamp.getTime())
        .filter((t) => t < latest),
    );
    const upTo = last ?? previous;
    const before = (list: Bars) =>
      Object.fromEntries(
        Object.entries(list).map(([s, l]) => [
          s,
          l.filter((b) => b.timestamp.getTime() <= upTo),
        ]),
      );
    feed(d, runtime, before(bars), before(marketBars), null);
    runtime.warmed = true;
    if (last === null && previous > 0) d.lastBarAt = new Date(previous);
  }
  const lastSeen = d.lastBarAt ? new Date(d.lastBarAt).getTime() : 0;
  if (latest > lastSeen) {
    const after = (list: Bars) =>
      Object.fromEntries(
        Object.entries(list).map(([s, l]) => [
          s,
          l.filter((b) => b.timestamp.getTime() > lastSeen),
        ]),
      );
    feed(d, runtime, after(bars), after(marketBars), new Date(latest), (t) =>
      snapshot(d, t),
    );
    d.lastBarAt = new Date(latest);
    await step(
      'checking your own stop / target levels',
      manualExits(d, runtime, deps, now),
    );
    dropHeldOffBuys(d, runtime, now);
    await step('sending orders', sendOrders(d, runtime, deps, now));
  }
  // Fills since the last close change the cash: refresh today's point.
  // Real-time news: buys that waited for the pre-open check, and held symbols' breaking news.
  await step(
    'checking the news before buying',
    releaseStaged(d, deps, now, (i, buy) =>
      placeOne(
        d,
        i,
        { symbol: buy.symbol, side: 'buy', qty: buy.qty, reason: buy.reason },
        deps,
        now,
        'passed the news check',
      ),
    ),
  );
  await step('sending orders that waited', retryOrders(d, deps, now));
  const sell = async (
    sells: Array<{ sleeve: number; symbol: string; qty: number; why: string }>,
    when: string,
  ) => {
    for (const s of sells)
      if (!d.ledgers[s.sleeve].pending.some((o) => o.symbol === s.symbol))
        await placeOne(
          d,
          s.sleeve,
          { symbol: s.symbol, side: 'sell', qty: s.qty, reason: s.why },
          deps,
          now,
          when,
        );
  };
  await sell(
    await step('watching the news on holdings', watchHeld(d, deps, now)),
    'sold on breaking news',
  );
  await sell(
    await step('reading earnings reports', watchEarnings(d, deps, now)),
    'sold on a bad earnings report',
  );
  if (d.lastBarAt) snapshot(d, new Date(d.lastBarAt));
  await step(
    'checking the drop alert',
    d.drawdownAlert
      ? drawdownAlert(d, deps, now)
      : guard(d, runtime, deps, now),
  );
}

/** Equity at a day's close (one point per day; the same day is updated). */
function snapshot(d: Deployment, at: Date): void {
  const equity = deploymentEquity(d);
  const day = at.toISOString().slice(0, 10);
  const last = d.snapshots.at(-1);
  if (last && new Date(last.timestamp).toISOString().slice(0, 10) === day)
    last.equity = equity;
  else d.snapshots.push({ timestamp: at, equity });
  d.peakEquity = Math.max(d.peakEquity, equity);
}

/** Pauses and sells everything when the deployment falls too far below its peak. */
async function guard(
  d: Deployment,
  runtime: Runtime,
  deps: CycleDeps,
  now: Date,
): Promise<void> {
  if (d.status !== 'active' || !(d.maxDrawdownPct > 0) || d.peakEquity <= 0)
    return;
  const drawdown = ((d.peakEquity - deploymentEquity(d)) / d.peakEquity) * 100;
  if (drawdown < d.maxDrawdownPct) return;
  d.status = 'paused';
  d.statusReason = `Guard: ${drawdown.toFixed(1)}% below its peak (limit ${d.maxDrawdownPct}%). Sold everything; resume when you've looked at it.`;
  logEvent(d, d.statusReason, now);
  await flatten(d, runtime, deps, now, 'drawdown guard');
}
