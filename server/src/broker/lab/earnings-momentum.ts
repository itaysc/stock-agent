import type { StrategyBar } from '../../strategies/strategy.types.js';
import type { Fact, Facts } from './sec-facts.js';

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) =>
  (Date.parse(b) - Date.parse(a)) / DAY_MS;

/** One quarter's number as first reported (what the market saw then). */
export interface Quarter {
  end: string;
  val: number;
  filed: string;
}

/** The first filing of each period with a span in [min, max] days. */
function firstFiled(list: Fact[], min: number, max: number): Fact[] {
  const byEnd = new Map<string, Fact>();
  for (const f of list) {
    if (!f.start) continue;
    const span = daysBetween(f.start, f.end);
    if (span < min || span > max) continue;
    const had = byEnd.get(f.end);
    if (!had || f.filed < had.filed) byEnd.set(f.end, f);
  }
  return [...byEnd.values()];
}

/**
 * A company's quarters from its SEC facts: the 3-month numbers of the 10-Qs,
 * and the fourth quarter worked out from the 10-K (the year minus its first
 * three quarters), dated when the 10-K was filed.
 */
export function quarters(list: Fact[] | undefined): Quarter[] {
  if (!list) return [];
  const q = firstFiled(list, 80, 100);
  const out: Quarter[] = q.map(({ end, val, filed }) => ({ end, val, filed }));
  for (const y of firstFiled(list, 350, 380)) {
    if (q.some((x) => Math.abs(daysBetween(x.end, y.end)) < 15)) continue;
    const inside = q.filter(
      (x) =>
        x.start &&
        daysBetween(y.start as string, x.start) > -10 &&
        daysBetween(x.end, y.end) > 60,
    );
    if (inside.length !== 3) continue;
    const sum = inside.reduce((n, x) => n + x.val, 0);
    out.push({ end: y.end, val: y.val - sum, filed: y.filed });
  }
  return out.sort((a, b) => a.end.localeCompare(b.end));
}

/** Quarters with the same priority order of names (e.g. revenue under several names): the first name that has a period wins. */
export function quartersOf(facts: Facts, names: string[]): Quarter[] {
  const byEnd = new Map<string, Quarter>();
  for (const n of names)
    for (const x of quarters(facts[n]))
      if (![...byEnd.keys()].some((e) => Math.abs(daysBetween(e, x.end)) < 15))
        byEnd.set(x.end, x);
  return [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
}

/**
 * Standardized unexpected earnings on a day: the latest public quarter minus
 * the same quarter a year before, divided by how much that yearly change
 * usually moves (its spread over the last 8 quarters). Null without enough
 * history or when the latest quarter is old.
 */
export function sue(series: Quarter[], at: string): number | null {
  const known = series.filter((x) => x.filed <= at);
  const last = known.at(-1);
  if (!last || daysBetween(last.end, at) > 200) return null;
  /** The change of each quarter from the same one a year earlier. */
  const changes: number[] = [];
  for (let i = known.length - 1; i >= 0 && changes.length < 8; i--) {
    const x = known[i];
    const ago = known.find(
      (y) => Math.abs(daysBetween(y.end, x.end) - 365) < 20,
    );
    if (ago) changes.push(x.val - ago.val);
    else if (i === known.length - 1) return null;
  }
  if (changes.length < 4) return null;
  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const sd = Math.sqrt(
    changes.reduce((n, c) => n + (c - mean) ** 2, 0) / (changes.length - 1),
  );
  return sd > 0 ? changes[0] / sd : null;
}

/** A stock's closes by day (YYYY-MM-DD, ascending), for announcementReturn. */
export interface DailyCloses {
  days: string[];
  closes: number[];
}
export const dailyCloses = (bars: StrategyBar[]): DailyCloses => ({
  days: bars.map((b) => b.timestamp.toISOString().slice(0, 10)),
  closes: bars.map((b) => b.close),
});
/** The index of the first day on or after `d` (days.length: none). */
function firstFrom(days: string[], d: string): number {
  let lo = 0;
  let hi = days.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (days[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The market's reaction to the latest earnings release before a day: the
 * stock's return from the close before the release day to the close the day
 * after, minus SPY's. Null when there was no release in the last ~100 days.
 */
export function announcementReturn(
  stock: DailyCloses,
  spy: DailyCloses,
  releases: string[],
  at: string,
): number | null {
  const release = releases.filter((d) => d <= at).at(-1);
  if (!release || daysBetween(release, at) > 100) return null;
  const move = ({ days, closes }: DailyCloses) => {
    const i = firstFrom(days, release);
    // The day after must be public by `at` too.
    if (i < 1 || i + 1 >= days.length || days[i + 1] > at) return null;
    return closes[i + 1] / closes[i - 1] - 1;
  };
  const s = move(stock);
  const m = move(spy);
  return s === null || m === null ? null : s - m;
}
