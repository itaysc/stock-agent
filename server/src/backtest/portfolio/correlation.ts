/** Step-to-step returns of an equity series. */
function returns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i - 1] > 0 ? values[i] / values[i - 1] - 1 : 0);
  }
  return out;
}

/** Pearson correlation; null when either series never moves. */
export function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const mean = (x: number[]) => x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return va === 0 || vb === 0 ? null : cov / Math.sqrt(va * vb);
}

/** Correlation of the daily returns of every pair of equity curves. */
export function correlationMatrix(
  curves: number[][],
): Array<Array<number | null>> {
  const r = curves.map(returns);
  return r.map((a, i) => r.map((b, j) => (i === j ? 1 : pearson(a, b))));
}
