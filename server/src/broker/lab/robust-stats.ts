import { curveStats, type Curve } from './profile-stats.js';

/** One test variation's result. */
export interface Variation {
  annualPct: number;
  maxDrawdownPct: number;
  /** Its yearly return in each of PERIODS. */
  periods?: Array<{ from: number; to: number; pct: number }>;
}

/** What one robustness part found (saved under .cache/robust, merged by `--part save`). */
export interface RobustPart {
  variations: Record<string, Variation[]>;
  periods?: Record<string, Array<{ from: number; to: number; pct: number }>>;
  tVsSpy?: Record<string, number>;
}

export const PERIODS = [
  ['2007-01-01', '2013-01-01'],
  ['2013-01-01', '2020-01-01'],
  ['2020-01-01', '2027-01-01'],
] as const;

export const variation = (c: Curve[]): Variation => {
  const s = curveStats(c);
  return {
    annualPct: s.annualPct,
    maxDrawdownPct: s.maxDrawdownPct,
    periods: periodReturns(c),
  };
};

/** The curve's yearly return in each of PERIODS. */
export const periodReturns = (c: Curve[]) =>
  PERIODS.map(([a, b]) => ({
    from: Number(a.slice(0, 4)),
    to: Number(b.slice(0, 4)) - 1,
    pct: curveStats(
      c.filter((p) => p.timestamp >= new Date(a) && p.timestamp < new Date(b)),
    ).annualPct,
  }));

/** Month-end values of a curve. */
const monthly = (c: Curve[]) => {
  const m = new Map<string, number>();
  for (const p of c)
    m.set(new Date(p.timestamp).toISOString().slice(0, 7), p.equity);
  return m;
};
const sd = (x: number[]) => {
  const mean = x.reduce((s, v) => s + v, 0) / x.length;
  return Math.sqrt(x.reduce((s, v) => s + (v - mean) ** 2, 0) / (x.length - 1));
};

/**
 * Yearly volatility, the 95% range (±) of the yearly return over the test,
 * and the t-statistic of beating SPY month by month (2 or more: more than luck).
 */
export function precision(c: Curve[], spy: Curve[]) {
  const a = monthly(c);
  const b = monthly(spy);
  const months = [...a.keys()].filter((k) => b.has(k)).sort();
  const r = (m: Map<string, number>) =>
    months
      .slice(1)
      .map((k, i) => (m.get(k) as number) / (m.get(months[i]) as number) - 1);
  const ra = r(a);
  const diff = ra.map((x, i) => x - r(b)[i]);
  const mean = diff.reduce((s, v) => s + v, 0) / diff.length;
  const vol = sd(ra) * Math.sqrt(12) * 100;
  return {
    vol,
    plusMinus: (1.96 * vol) / Math.sqrt(ra.length / 12),
    tVsSpy: sd(diff) > 0 ? mean / (sd(diff) / Math.sqrt(diff.length)) : 0,
  };
}

/** The p-th percentile (0-1) of the numbers, interpolated. */
export function percentile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const at = (s.length - 1) * p;
  const lo = Math.floor(at);
  return s[lo] + (s[Math.ceil(at)] - s[lo]) * (at - lo);
}
