import type { BacktestService } from '../backtest/backtest.service.js';
import type { StrategyBar } from '../strategies/strategy.types.js';

const DAY_MS = 86_400_000;

/** The chart's ranges: how far back, and the bar size. */
export const CHART_RANGES = {
  '1d': { days: 5, timeframe: '5Min', sessions: 1 },
  '5d': { days: 10, timeframe: '15Min', sessions: 5 },
  '1m': { days: 31, timeframe: '1Day' },
  '3m': { days: 92, timeframe: '1Day' },
  '6m': { days: 183, timeframe: '1Day' },
  '1y': { days: 366, timeframe: '1Day' },
  '5y': { days: 1827, timeframe: '1Day' },
  /** From 3 months before the buy (the default). */
  buy: { days: 90, timeframe: '1Day' },
} as const;
export type ChartRange = keyof typeof CHART_RANGES;
export const isChartRange = (r: string): r is ChartRange => r in CHART_RANGES;

/** The New York trading day of a bar. */
const session = (t: Date) =>
  t.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/**
 * A symbol's bars for a chart range: intraday for 1D / 5D (only the last 1 or
 * 5 sessions), daily otherwise; "buy" starts 3 months before `opened`.
 */
export async function rangeBars(
  backtests: BacktestService,
  symbol: string,
  range: ChartRange,
  opened: Date | null,
  now = new Date(),
): Promise<StrategyBar[]> {
  const r = CHART_RANGES[range];
  const anchor = range === 'buy' && opened ? opened : now;
  const from = new Date(anchor.getTime() - r.days * DAY_MS);
  const bars =
    (
      await backtests.fetchBars([symbol], {
        timeframe: r.timeframe,
        from,
        to: now,
      })
    )[symbol] ?? [];
  if (!('sessions' in r)) return bars;
  const days = [...new Set(bars.map((b) => session(b.timestamp)))].slice(
    -r.sessions,
  );
  return bars.filter((b) => days.includes(session(b.timestamp)));
}

/** The moving averages the chart can show (days). */
export const MA_DAYS = [20, 50, 200] as const;

/** Each day's average of the last `n` closes (null until there are `n`). */
export function sma(closes: number[], n: number): Array<number | null> {
  let sum = 0;
  return closes.map((c, i) => {
    sum += c;
    if (i >= n) sum -= closes[i - n];
    return i >= n - 1 ? sum / n : null;
  });
}

/**
 * The 20-, 50- and 200-day moving averages from `from` on, computed with
 * enough earlier history that they are right from the chart's first day.
 */
export async function movingAverages(
  backtests: BacktestService,
  symbol: string,
  from: Date,
  now = new Date(),
): Promise<Record<string, Array<{ time: Date; value: number }>>> {
  // 200 trading days ≈ 290 calendar days.
  const start = new Date(from.getTime() - 300 * DAY_MS);
  const bars =
    (
      await backtests.fetchBars([symbol], {
        timeframe: '1Day',
        from: start,
        to: now,
      })
    )[symbol] ?? [];
  const closes = bars.map((b) => b.close);
  return Object.fromEntries(
    MA_DAYS.map((n) => {
      const avg = sma(closes, n);
      return [
        String(n),
        bars.flatMap((b, i) =>
          b.timestamp >= from && avg[i] !== null
            ? [{ time: b.timestamp, value: avg[i] as number }]
            : [],
        ),
      ];
    }),
  );
}
