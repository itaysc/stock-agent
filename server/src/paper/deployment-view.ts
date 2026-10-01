import { sleeveLabel } from '../backtest/portfolio/portfolio.service.js';
import { annualizedPct } from '../backtest/walkforward/walkforward-metrics.js';
import { deploymentEquity, reserveOf } from './deployment-cycle.js';
import type { Deployment } from './deployment.types.js';
import { ledgerEquity } from './sleeve-ledger.js';

/** Trading days live before live-vs-expected is judged. */
const MIN_DAYS = 20;

export type Health = 'warming-up' | 'on-track' | 'behind' | 'deeper-drop';

/** Live vs the backtest's expectation, in plain terms. */
function health(
  d: Deployment,
  drawdownPct: number,
  liveAnnualPct: number | null,
): { health: Health; healthText: string } {
  const e = d.expectation;
  if (e && drawdownPct > e.maxDrawdownPct * 1.2 && drawdownPct > 3) {
    return {
      health: 'deeper-drop',
      healthText: `It has dropped ${drawdownPct.toFixed(1)}% from its peak: more than the backtest's worst (${e.maxDrawdownPct.toFixed(1)}%).`,
    };
  }
  if (
    d.snapshots.length < MIN_DAYS ||
    !e ||
    liveAnnualPct === null ||
    e.annualPct === null
  ) {
    return {
      health: 'warming-up',
      healthText: `Too early to judge: ${d.snapshots.length} of ${MIN_DAYS} trading days.`,
    };
  }
  const behind = liveAnnualPct < e.annualPct - 10;
  return behind
    ? {
        health: 'behind',
        healthText: `Behind the backtest: ${liveAnnualPct.toFixed(1)}% a year live vs ${e.annualPct.toFixed(1)}% expected.`,
      }
    : {
        health: 'on-track',
        healthText: `In line with the backtest: ${liveAnnualPct.toFixed(1)}% a year live vs ${e.annualPct.toFixed(1)}% expected.`,
      };
}

/** Everything the dashboard shows about a deployment. */
export function deploymentView(d: Deployment, { full = false } = {}) {
  const equity = deploymentEquity(d);
  const drawdownPct =
    d.peakEquity > 0
      ? Math.max(0, ((d.peakEquity - equity) / d.peakEquity) * 100)
      : 0;
  const first = d.snapshots[0];
  const liveAnnualPct =
    first && d.snapshots.length >= MIN_DAYS
      ? annualizedPct(
          (equity / d.capital - 1) * 100,
          new Date(first.timestamp),
          new Date(),
        )
      : null;
  const trades = d.ledgers
    .flatMap((l, i) => l.trades.map((t) => ({ ...t, sleeve: i + 1 })))
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    statusReason: d.statusReason,
    source: d.source,
    capital: d.capital,
    equity,
    pnl: equity - d.capital,
    pnlPct: (equity / d.capital - 1) * 100,
    drawdownPct,
    maxDrawdownPct: d.maxDrawdownPct,
    newsCheck: d.newsCheck ?? null,
    daysLive: d.snapshots.length,
    liveAnnualPct,
    expectation: d.expectation,
    ...health(d, drawdownPct, liveAnnualPct),
    reserve: reserveOf(d),
    sleeves: d.sleeves.map((s, i) => {
      const l = d.ledgers[i];
      return {
        label: sleeveLabel(s),
        sleeve: s,
        equity: ledgerEquity(l),
        cash: l.cash,
        realizedPnl: l.realizedPnl,
        positions: Object.values(l.positions).map((p) => ({
          ...p,
          lastPrice: l.lastPrices[p.symbol] ?? null,
        })),
        pending: l.pending,
        staged: l.staged ?? [],
        trades: l.trades.length,
      };
    }),
    lastBarAt: d.lastBarAt,
    createdAt: d.createdAt,
    ...(full
      ? {
          snapshots: d.snapshots,
          events: [...d.events].reverse().slice(0, 100),
          trades: trades.slice(0, 100),
        }
      : {}),
  };
}
