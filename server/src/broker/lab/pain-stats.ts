import type { Curve } from './profile-stats.js';

const MONTH_MS = (365.25 / 12) * 86_400_000;
const day = (t: Date) => new Date(t).toISOString().slice(0, 10);

/** How hard a curve was to live with, beyond its worst drop. */
export interface PainStats {
  /** Yearly return ÷ worst drop (higher = more return per unit of the worst pain). */
  calmar: number;
  /** Ulcer index: the root-mean-square of the daily % below the peak (depth and length of the drops; lower = calmer). */
  ulcerIndex: number;
  /** The longest stretch below an earlier peak, in months (the wait to get back to even). */
  longestUnderwaterMonths: number;
  /** Against SPY over every 3-year stretch (month to month): how often it did worse, and its worst gap (yearly % points). */
  vsSpy3y?: { trailedPct: number; worstGapPct: number };
}

/** The deepest drop below a running peak (in %), the ulcer index, and the longest time below a peak (months). */
function drawdowns(pts: Array<{ t: number; v: number }>) {
  let peak = pts[0]?.v ?? 0;
  let peakAt = pts[0]?.t ?? 0;
  let worst = 0;
  let squares = 0;
  let longest = 0;
  for (const p of pts) {
    if (p.v >= peak) {
      peak = p.v;
      peakAt = p.t;
    }
    const dd = (1 - p.v / peak) * 100;
    worst = Math.max(worst, dd);
    squares += dd * dd;
    longest = Math.max(longest, (p.t - peakAt) / MONTH_MS);
  }
  return {
    worst,
    ulcer: pts.length ? Math.sqrt(squares / pts.length) : 0,
    longest,
  };
}

/** Pain numbers of a curve; with `spy`, also how far and how long it fell behind SPY. */
export function painStats(curve: Curve[], spy?: Curve[]): PainStats {
  const pts = [...curve]
    .map((c) => ({ t: new Date(c.timestamp).getTime(), v: c.equity }))
    .sort((a, b) => a.t - b.t);
  const d = drawdowns(pts);
  const first = pts[0];
  const last = pts.at(-1);
  const years = first && last ? (last.t - first.t) / (12 * MONTH_MS) : 0;
  const annual =
    first && last && years > 0
      ? ((last.v / first.v) ** (1 / years) - 1) * 100
      : 0;
  const out: PainStats = {
    calmar: d.worst > 0 ? annual / d.worst : 0,
    ulcerIndex: d.ulcer,
    longestUnderwaterMonths: d.longest,
  };
  if (spy?.length) out.vsSpy3y = rolling3y(pts, spy);
  return out;
}

/** Every 3-year stretch between month-ends: the share in which the curve trailed SPY, and the worst yearly gap. */
function rolling3y(
  pts: Array<{ t: number; v: number }>,
  spy: Curve[],
): { trailedPct: number; worstGapPct: number } {
  const monthEnds = (xs: Array<{ t: number; v: number }>) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(day(new Date(x.t)).slice(0, 7), x.v);
    return m;
  };
  const a = monthEnds(pts);
  const b = monthEnds(
    spy.map((s) => ({ t: new Date(s.timestamp).getTime(), v: s.equity })),
  );
  const months = [...a.keys()].filter((k) => b.has(k)).sort();
  const yearly = (end: number, start: number) =>
    ((end / start) ** (1 / 3) - 1) * 100;
  const gaps = months.slice(36).map((k, i) => {
    const from = months[i];
    return (
      yearly(a.get(k) as number, a.get(from) as number) -
      yearly(b.get(k) as number, b.get(from) as number)
    );
  });
  return gaps.length
    ? {
        trailedPct: (gaps.filter((g) => g < 0).length / gaps.length) * 100,
        worstGapPct: Math.min(...gaps),
      }
    : { trailedPct: 0, worstGapPct: 0 };
}
