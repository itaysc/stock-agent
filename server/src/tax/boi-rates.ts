/** One day's official dollar rate (the Bank of Israel's representative rate, שער יציג). */
export interface DayRate {
  /** YYYY-MM-DD */
  date: string;
  /** Shekels per dollar. */
  rate: number;
}

/** The Bank of Israel's daily USD/ILS representative rates between two days (inclusive), as CSV. */
export const boiRatesUrl = (from: string, to: string) =>
  `https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS?startperiod=${from}&endperiod=${to}&format=csv`;

/** The rates in the Bank of Israel's CSV (columns TIME_PERIOD and OBS_VALUE). */
export function parseBoiCsv(csv: string): DayRate[] {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const cols = (header ?? '').split(',');
  const at = cols.indexOf('TIME_PERIOD');
  const val = cols.indexOf('OBS_VALUE');
  if (at < 0 || val < 0) return [];
  return rows
    .map((r) => r.split(','))
    .map((c) => ({ date: c[at], rate: Number(c[val]) }))
    .filter(
      (x) =>
        /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
        Number.isFinite(x.rate) &&
        x.rate > 0,
    );
}

/** The rate for a day: that day's, or the last one published before it (weekends, holidays). */
export function rateFor(sorted: DayRate[], day: string): DayRate | null {
  let found: DayRate | null = null;
  for (const r of sorted) {
    if (r.date > day) break;
    found = r;
  }
  return found;
}
