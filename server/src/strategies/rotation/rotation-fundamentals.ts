/**
 * What a company's latest public reports said on a day: value (earnings and
 * book value per dollar of market value) and quality (gross profit and net
 * income per dollar of assets). Null where it wasn't reported.
 */
export interface Fundamentals {
  /** Earnings yield: net income ÷ market value. */
  ep: number | null;
  /** Book-to-market: shareholders' equity ÷ market value. */
  bm: number | null;
  /** Gross profitability: gross profit ÷ assets. */
  gpa: number | null;
  /** Return on assets: net income ÷ assets. */
  roa: number | null;
  /** Turnover: average daily dollar volume (6 months) ÷ market value (crowdFilter 2). */
  turnover?: number | null;
  /** Earnings surprise: the latest quarter's yearly change in net income ÷ its usual spread (blend 6, 8, 9). */
  sue?: number | null;
  /** The same for revenue (blend 8, 9). */
  sueRev?: number | null;
  /** The stock's move around its latest earnings release, minus SPY's (blend 7, 8, 9). */
  ear?: number | null;
}

type Source = (symbol: string, at: Date) => Fundamentals | null;
let source: Source | null = null;

/** The algo lab plugs in SEC data here (the live broker has none, so `blend` stays off there). */
export const fundamentals = {
  set(fn: Source | null): void {
    source = fn;
  },
  of(symbol: string, at: Date): Fundamentals | null {
    return source?.(symbol, at) ?? null;
  },
};

/** Each symbol's percentile (0 = lowest, 1 = highest) of a number; missing ones get 0.5. */
function percentiles(
  symbols: string[],
  value: (s: string) => number | null,
): Map<string, number> {
  const known = symbols
    .map((s) => ({ s, v: value(s) }))
    .filter(
      (x): x is { s: string; v: number } =>
        x.v !== null && Number.isFinite(x.v),
    )
    .sort((a, b) => a.v - b.v);
  const out = new Map(symbols.map((s) => [s, 0.5]));
  known.forEach((x, i) =>
    out.set(x.s, known.length > 1 ? i / (known.length - 1) : 0.5),
  );
  return out;
}

const avg = (...xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Scores to rank by when mixing momentum with the reports (higher = better):
 * 1 momentum + value, 2 momentum + quality, 3 all three, 4 momentum among the
 * better-quality half only, 5 value + quality without momentum; earnings
 * momentum: 6 momentum + earnings surprise, 7 momentum + the reaction to the
 * release, 8 momentum + all three earnings measures, 9 momentum among the
 * better earnings-momentum half only.
 */
export function blendScores(
  symbols: string[],
  at: Date,
  momentum: (s: string) => number,
  blend: number,
): Map<string, number> {
  const f = new Map(symbols.map((s) => [s, fundamentals.of(s, at)]));
  const mom = percentiles(symbols, momentum);
  const pr = (k: keyof Fundamentals) =>
    percentiles(symbols, (s) => f.get(s)?.[k] ?? null);
  const [ep, bm, gpa, roa] = [pr('ep'), pr('bm'), pr('gpa'), pr('roa')];
  const get = (m: Map<string, number>, s: string) => m.get(s) ?? 0.5;
  const value = (s: string) => avg(get(ep, s), get(bm, s));
  const quality = (s: string) => avg(get(gpa, s), get(roa, s));
  const [sue, sueRev, ear] = [pr('sue'), pr('sueRev'), pr('ear')];
  const earnings = (s: string) => avg(get(sue, s), get(sueRev, s), get(ear, s));
  const score = (s: string): number => {
    const m = get(mom, s);
    switch (blend) {
      case 1:
        return avg(m, value(s));
      case 2:
        return avg(m, quality(s));
      case 3:
        return avg(m, value(s), quality(s));
      case 4:
        return quality(s) >= 0.5 ? m : m - 2; // the lower-quality half ranks below all of the better half
      case 6:
        return avg(m, get(sue, s));
      case 7:
        return avg(m, get(ear, s));
      case 8:
        return avg(m, earnings(s));
      case 9:
        return earnings(s) >= 0.5 ? m : m - 2;
      default:
        return avg(value(s), quality(s));
    }
  };
  return new Map(symbols.map((s) => [s, score(s)]));
}
