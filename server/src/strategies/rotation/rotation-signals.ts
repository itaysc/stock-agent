/** Daily returns of closes c[from..to] (inclusive). */
const moves = (c: number[], from: number, to: number) =>
  c
    .slice(Math.max(0, from), to + 1)
    .flatMap((x, i, a) => (i ? [x / a[i - 1] - 1] : []));

/**
 * How steadily a stock got its return over the n bars before `end`: the share
 * of up days minus down days, signed by the return ("frog in the pan"). A
 * winner that rose a little on most days scores high; one that got there in a
 * few jumps scores low.
 */
export function steadiness(c: number[], end: number, n: number): number {
  const m = moves(c, end - n, end);
  if (!m.length) return 0;
  const up = m.filter((x) => x > 0).length / m.length;
  const down = m.filter((x) => x < 0).length / m.length;
  return Math.sign(c[end] / c[end - n] - 1) * (up - down);
}

/** The average of the returns over a quarter, half and all of the lookback (e.g. 3, 6 and 12 months). */
export function mixedReturn(
  c: number[],
  end: number,
  lookback: number,
): number {
  const ret = (n: number) => c[end] / c[end - n] - 1;
  return (
    (ret(Math.round(lookback / 4)) +
      ret(Math.round(lookback / 2)) +
      ret(lookback)) /
    3
  );
}

/**
 * Yearly volatility (%) of the picks held together with these weights over
 * their last `days` closes: what the stocks part would have swung, with how
 * they move together. Null without enough history.
 */
export function basketVolPct(
  picks: string[],
  weights: number[],
  closes: Map<string, number[]>,
  days: number,
): number | null {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!picks.length || !(total > 0)) return null;
  const n = Math.min(
    days,
    ...picks.map((s) => (closes.get(s)?.length ?? 0) - 1),
  );
  if (n < 20) return null;
  const daily = Array.from({ length: n }, (_, d) =>
    picks.reduce((sum, s, i) => {
      const c = closes.get(s) ?? [];
      const at = c.length - n + d;
      return sum + (weights[i] / total) * (c[at] / c[at - 1] - 1);
    }, 0),
  );
  const mean = daily.reduce((a, b) => a + b, 0) / n;
  const variance = daily.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance * 252) * 100;
}
