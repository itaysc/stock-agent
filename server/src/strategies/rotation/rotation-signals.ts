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

/**
 * Residual momentum: how much a stock beat what the market's move explains
 * (its own part, return minus beta × the market's), per unit of that part's
 * noise, over the n bars before `end`. `market` ends on the same day as `c`.
 */
export function residualScore(
  c: number[],
  market: number[],
  end: number,
  n: number,
): number {
  const lag = c.length - 1 - end;
  const mEnd = market.length - 1 - lag;
  if (end - n < 0 || mEnd - n < 0) return NaN;
  const rs = moves(c, end - n, end);
  const rm = moves(market, mEnd - n, mEnd);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const ms = mean(rs);
  const mm = mean(rm);
  const cov = rs.reduce((n2, x, i) => n2 + (x - ms) * (rm[i] - mm), 0);
  const varM = rm.reduce((n2, x) => n2 + (x - mm) ** 2, 0);
  const beta = varM > 0 ? cov / varM : 1;
  const resid = rs.map((x, i) => x - beta * rm[i]);
  const mr = mean(resid);
  const sd = Math.sqrt(
    resid.reduce((n2, x) => n2 + (x - mr) ** 2, 0) / (resid.length - 1),
  );
  return sd > 0 ? mr / sd : 0;
}

/** How close the last close is to the highest close of the last n bars (1 = at the high). */
export function nearHigh(c: number[], n: number): number {
  const last = c.slice(-n);
  return last.length ? (c.at(-1) ?? 0) / Math.max(...last) : 0;
}

/** Recent volume against the stock's own past: the last `short` days' average ÷ the last `long` days' (null without enough). */
export function volumeSurge(
  v: number[],
  short = 63,
  long = 252,
): number | null {
  if (v.length < long) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const base = avg(v.slice(-long));
  return base > 0 ? avg(v.slice(-short)) / base : null;
}
