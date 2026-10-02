import { readFileSync } from 'node:fs';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import { yahooDaily } from './yahoo-history.js';

const DAY_MS = 86_400_000;

interface Span {
  ticker: string;
  start: Date;
  end: Date | null;
}

/** sp500_ticker_start_end.csv (github.com/fja05680/sp500, MIT): when each ticker was in the index. */
export function readSpans(file: string): Span[] {
  return readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [ticker, start, end] = line.split(',');
      return {
        ticker,
        start: new Date(start),
        end: end ? new Date(end) : null,
      };
    });
}

const memberOn = (spans: Span[], at: Date) => [
  ...new Set(
    spans
      .filter((s) => s.start <= at && (!s.end || s.end > at))
      .map((s) => s.ticker),
  ),
];

/** Average daily dollar volume over the year before `at` (null with under ~10 months of history). */
function dollarVolume(bars: StrategyBar[], at: Date): number | null {
  const year = bars.filter(
    (b) =>
      b.timestamp < at && b.timestamp >= new Date(at.getTime() - 365 * DAY_MS),
  );
  if (year.length < 200) return null;
  return year.reduce((n, b) => n + b.close * b.volume, 0) / year.length;
}

/**
 * A point-in-time universe: each January 1st, the `n` most-traded S&P 500
 * members of that day (dollar volume over the past year, a free stand-in for
 * size). Companies Yahoo no longer has (bankrupt, bought out) can't be picked,
 * so some survivorship remains, far less than using today's list.
 */
export async function sp500Top(
  n: number,
  from: Date,
  to: Date,
  spansFile: string,
  cacheDir: string,
) {
  const spans = readSpans(spansFile);
  const firstYear = from.getUTCFullYear();
  const lastYear = to.getUTCFullYear();
  const candidates = [
    ...new Set(
      spans
        .filter(
          (s) => !s.end || s.end >= new Date(Date.UTC(firstYear - 1, 0, 1)),
        )
        .map((s) => s.ticker),
    ),
  ];
  const bars = await yahooDaily(
    candidates,
    new Date(Date.UTC(firstYear - 1, 0, 1)),
    to,
    cacheDir,
  );
  const missing = candidates.filter((t) => !bars[t]?.length);
  const yearly = new Map<number, string[]>();
  for (let y = firstYear; y <= lastYear; y++) {
    const jan1 = new Date(Date.UTC(y, 0, 1));
    const ranked = memberOn(spans, jan1)
      .map((t) => ({ t, dv: dollarVolume(bars[t] ?? [], jan1) }))
      .filter((x): x is { t: string; dv: number } => x.dv !== null)
      .sort((a, b) => b.dv - a.dv)
      .slice(0, n)
      .map((x) => x.t);
    yearly.set(y, ranked);
  }
  const sets = new Map([...yearly].map(([y, list]) => [y, new Set(list)]));
  return {
    yearly,
    missing,
    symbols: [...new Set([...yearly.values()].flat())],
    allowed: (symbol: string, at: Date) =>
      sets.get(at.getUTCFullYear())?.has(symbol) ?? false,
  };
}
