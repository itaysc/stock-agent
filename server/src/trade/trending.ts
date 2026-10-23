/** One stock's trend numbers for Discovery. */
export interface Trending {
  symbol: string;
  price: number;
  /** Return over the last 12 months, leaving out the latest month (the broker's ranking rule), in %. */
  momentumPct: number;
  /** Return over the last 3 months, in %. */
  threeMonthPct: number;
  /** The last close is above its 200-day average (a rising trend). */
  aboveTrend: boolean;
  /** Yearly volatility from the last 3 months of daily moves, in %. */
  volatilityPct: number;
  /** About 3 months of closes, for the small chart. */
  spark: Array<{ t: string; c: number }>;
}

const YEAR = 252;
const MONTH = 21;

/**
 * Each stock's trend from its daily closes, best first: those above their
 * 200-day average, then the rest, each by 12-1 month momentum. Stocks with
 * less than about a year of history are left out.
 */
export function rankTrending(
  bars: Record<string, Array<{ timestamp: Date; close: number }>>,
): Trending[] {
  const out: Trending[] = [];
  for (const [symbol, list] of Object.entries(bars)) {
    const c = list.map((b) => b.close);
    const n = c.length;
    if (n < YEAR + MONTH + 1) continue;
    const last = c[n - 1];
    const avg200 = c.slice(-200).reduce((a, b) => a + b, 0) / 200;
    const moves = c
      .slice(-63)
      .map((x, i, a) => (i ? Math.log(x / a[i - 1]) : 0))
      .slice(1);
    const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
    const sd = Math.sqrt(
      moves.reduce((a, b) => a + (b - mean) ** 2, 0) / (moves.length - 1),
    );
    out.push({
      symbol,
      price: last,
      momentumPct: (c[n - 1 - MONTH] / c[n - 1 - MONTH - YEAR] - 1) * 100,
      threeMonthPct: (last / c[n - 1 - 63] - 1) * 100,
      aboveTrend: last > avg200,
      volatilityPct: sd * Math.sqrt(YEAR) * 100,
      spark: list.slice(-63).map((b) => ({
        t: new Date(b.timestamp).toISOString(),
        c: b.close,
      })),
    });
  }
  return out.sort(
    (a, b) =>
      Number(b.aboveTrend) - Number(a.aboveTrend) ||
      b.momentumPct - a.momentumPct,
  );
}
