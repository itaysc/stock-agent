export interface Curve {
  timestamp: Date;
  equity: number;
}

/** What a profile did over the test, in plain numbers (saved in profile_stats for the app). */
export interface CurveStats {
  from: Date;
  to: Date;
  totalPct: number;
  annualPct: number;
  maxDrawdownPct: number;
  worstYear: { year: number; pct: number };
  bestYear: { year: number; pct: number };
  positiveYearsPct: number;
  years: Array<{ year: number; pct: number }>;
}

/** Totals, worst drop and each calendar year's return of an equity curve. */
export function curveStats(curve: Curve[]): CurveStats {
  const pts = [...curve].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const first = pts[0];
  const last = pts.at(-1) as Curve;
  let peak = first.equity;
  let maxDrawdownPct = 0;
  const yearEnd = new Map<number, number>();
  for (const p of pts) {
    peak = Math.max(peak, p.equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, (1 - p.equity / peak) * 100);
    yearEnd.set(new Date(p.timestamp).getUTCFullYear(), p.equity);
  }
  let prev = first.equity;
  const years = [...yearEnd].map(([year, end]) => {
    const pct = (end / prev - 1) * 100;
    prev = end;
    return { year, pct };
  });
  // A partial first or last year is still shown, but not counted as the best or worst year.
  const full = years.filter(
    (y) =>
      y.year > new Date(first.timestamp).getUTCFullYear() &&
      y.year < new Date(last.timestamp).getUTCFullYear(),
  );
  const pick = (better: (a: number, b: number) => boolean) =>
    full.reduce(
      (best, y) => (better(y.pct, best.pct) ? y : best),
      full[0] ?? years[0],
    );
  const span =
    (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) /
    (365.25 * 86_400_000);
  return {
    from: new Date(first.timestamp),
    to: new Date(last.timestamp),
    totalPct: (last.equity / first.equity - 1) * 100,
    annualPct: ((last.equity / first.equity) ** (1 / span) - 1) * 100,
    maxDrawdownPct,
    worstYear: pick((a, b) => a < b),
    bestYear: pick((a, b) => a > b),
    positiveYearsPct: full.length
      ? (full.filter((y) => y.pct > 0).length / full.length) * 100
      : 0,
    years,
  };
}

/** Mixes curves (each part grows on its own, re-balanced to the weights every year) into one curve. */
export function mixedCurve(
  parts: Array<{ curve: Curve[]; weight: number }>,
): Curve[] {
  if (parts.length === 1) return parts[0].curve;
  const day = (t: Date) => new Date(t).toISOString().slice(0, 10);
  const maps = parts.map(
    (p) => new Map(p.curve.map((c) => [day(c.timestamp), c.equity])),
  );
  const days = [...maps[0].keys()]
    .filter((d) => maps.every((m) => m.has(d)))
    .sort();
  let hold = parts.map((p) => p.weight);
  const out: Curve[] = [{ timestamp: new Date(days[0]), equity: 1 }];
  for (let i = 1; i < days.length; i++) {
    hold = hold.map(
      (h, k) =>
        (h * (maps[k].get(days[i]) as number)) /
        (maps[k].get(days[i - 1]) as number),
    );
    const total = hold.reduce((a, b) => a + b, 0);
    out.push({ timestamp: new Date(days[i]), equity: total });
    if (days[i].slice(0, 4) !== days[i - 1].slice(0, 4))
      hold = parts.map((p) => p.weight * total);
  }
  return out;
}
