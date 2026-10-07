import type { BacktestService } from '../backtest/backtest.service.js';
import { runBacktest } from '../backtest/backtest-engine.js';
import type { Deployment } from '../paper/deployment.types.js';
import { usesMarket } from '../strategies/rules/rules-validate.js';
import { createStrategy } from '../strategies/strategy-registry.js';

const DAY_MS = 86_400_000;
/** History before the start for the strategy's indicators (12 months + a month skipped, with room). */
const WARMUP_DAYS = 450;
const day = (t: Date | string) => new Date(t).toISOString().slice(0, 10);

export interface TrackedTrade {
  date: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
}

/** An investment's live days next to the same setup backtested over the same days. */
export interface Tracking {
  from: string;
  days: Array<{ date: string; live: number; test: number | null }>;
  liveReturnPct: number;
  testReturnPct: number | null;
  /** Live minus backtest, in percentage points. */
  gapPct: number | null;
  /** Buys and sells: in both, only live (e.g. your own sells, news checks), only in the backtest. */
  trades: {
    both: TrackedTrade[];
    liveOnly: TrackedTrade[];
    testOnly: TrackedTrade[];
  };
}

/**
 * What the backtest says the investment should have done since it started:
 * each sleeve's strategy with the same settings and money, warmed up on the
 * history before (so day one is the same signal the broker acted on), fills
 * at the next open. It can't know the news and earnings checks, your own
 * actions, or real fill prices: those are the usual differences.
 */
export async function trackingOf(
  backtests: BacktestService,
  d: Deployment,
  now = new Date(),
): Promise<Tracking | null> {
  const first = d.snapshots[0];
  if (!first) return null;
  const startAt = new Date(first.timestamp);
  const range = {
    timeframe: '1Day',
    from: new Date(startAt.getTime() - WARMUP_DAYS * DAY_MS),
    to: now,
  };
  const curves: Array<Map<string, number>> = [];
  const testTrades: TrackedTrade[] = [];
  for (const sleeve of d.sleeves) {
    const bars = await backtests.fetchBars(sleeve.symbols, range);
    const market = await backtests.fetchMarket(
      usesMarket([sleeve.strategy], sleeve.params),
      range,
    );
    const r = runBacktest(
      createStrategy(sleeve.strategy, sleeve.symbols, sleeve.params),
      bars,
      {
        initialCash: (d.capital * sleeve.weightPct) / 100,
        slippageBps: 5,
        feePerShare: 0,
      },
      { startAt, market },
    );
    curves.push(
      new Map(r.equityCurve.map((p) => [day(p.timestamp), p.equity])),
    );
    for (const f of r.fills)
      testTrades.push({
        date: day(f.timestamp),
        symbol: f.symbol,
        side: f.side,
        price: f.price,
      });
  }
  const reserve =
    d.capital -
    d.sleeves.reduce((n, s) => n + (d.capital * s.weightPct) / 100, 0);
  const last = curves.map(() => null as number | null);
  const days = d.snapshots.map((s, i) => {
    const date = day(s.timestamp);
    curves.forEach((c, k) => (last[k] = c.get(date) ?? last[k]));
    const test = last.every((x) => x !== null)
      ? (last as number[]).reduce((a, b) => a + b, reserve)
      : null;
    // The first day is the decision day: both start at the amount put in (see dailyResults).
    return { date, live: i === 0 ? d.capital : s.equity, test };
  });
  const end = days.at(-1);
  const pct = (x: number) => (x / d.capital - 1) * 100;
  const liveReturnPct = pct(end?.live ?? d.capital);
  const testReturnPct = end?.test != null ? pct(end.test) : null;
  const liveTrades = d.ledgers.flatMap((l) =>
    l.trades.map((t) => ({
      date: day(t.timestamp),
      symbol: t.symbol,
      side: t.side,
      price: t.price,
    })),
  );
  return {
    from: day(startAt),
    days,
    liveReturnPct,
    testReturnPct,
    gapPct: testReturnPct === null ? null : liveReturnPct - testReturnPct,
    trades: matchTrades(liveTrades, testTrades),
  };
}

/** Pairs live and backtest trades by stock and side (in order); the rest are only in one of them. */
export function matchTrades(live: TrackedTrade[], test: TrackedTrade[]) {
  const left = [...test];
  const both: TrackedTrade[] = [];
  const liveOnly: TrackedTrade[] = [];
  for (const t of live) {
    const i = left.findIndex((x) => x.symbol === t.symbol && x.side === t.side);
    if (i < 0) liveOnly.push(t);
    else {
      both.push(t);
      left.splice(i, 1);
    }
  }
  return { both, liveOnly, testOnly: left };
}
