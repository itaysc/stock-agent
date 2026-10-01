/**
 * Client-side mirror of the server's sweep value syntax, for live previews:
 * "10" (one value), "5,10,20" (a list), "5..30:5" (a range with a step).
 * The server validates again.
 */
export function expandValues(spec: string): {
  values: number[];
  error?: string;
} {
  const value = spec.trim();
  if (!value) return { values: [] }; // empty = strategy default
  const range = /^(-?[\d.]+)\.\.(-?[\d.]+)(?::([\d.]+))?$/.exec(value);
  if (range) {
    const [start, end, step] = [range[1], range[2], range[3] ?? '1'].map(Number);
    if (![start, end, step].every(Number.isFinite) || step <= 0 || end < start) {
      return { values: [], error: 'Use start..end:step, e.g. 5..30:5' };
    }
    const count = Math.floor((end - start) / step + 1e-9) + 1;
    if (count > 100_000) return { values: [], error: 'Too many values' };
    return {
      values: Array.from({ length: count }, (_, i) => Number((start + i * step).toFixed(10))),
    };
  }
  const items = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (items.some((v) => !Number.isFinite(Number(v)))) {
    return { values: [], error: 'Numbers only: 10, 5,10,20 or 5..30:5' };
  }
  return { values: items.map(Number) };
}

export function countValues(spec: string): { count: number; error?: string } {
  if (!spec.trim()) return { count: 1 };
  const { values, error } = expandValues(spec);
  return { count: values.length, error };
}

/** Number of backtests a strategy's specs expand to. */
export function comboCount(specs: Record<string, string>): number {
  return Object.values(specs).reduce((n, spec) => n * countValues(spec).count, 1);
}
