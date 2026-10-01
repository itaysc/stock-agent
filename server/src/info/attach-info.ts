import type { StrategyBar } from '../strategies/strategy.types.js';
import type { EarningsReport } from './earnings.schema.js';
import type { DailyNews } from './news.service.js';
import { barDay } from './session-day.js';

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

/**
 * Sets each bar's news: the headlines since the previous bar's close up to
 * this bar's close (weekends and holidays roll into the next trading day).
 */
export function attachNews(bars: StrategyBar[], news: DailyNews): void {
  const days = [...news.keys()].sort();
  let i = 0;
  // Headlines from before the first bar's day belong to earlier bars (outside this range).
  const first = bars[0] ? barDay(bars[0].timestamp) : '';
  while (i < days.length && days[i] < first) i++;
  for (const bar of bars) {
    const day = barDay(bar.timestamp);
    let sum = 0;
    let count = 0;
    let preSum = 0;
    let preCount = 0;
    while (i < days.length && days[i] <= day) {
      const key = days[i++];
      const d = news.get(key);
      sum += d?.sum ?? 0;
      count += d?.count ?? 0;
      // Days without a session (weekends, holidays) all came before this open.
      preSum += key < day ? (d?.sum ?? 0) : (d?.preSum ?? 0);
      preCount += key < day ? (d?.count ?? 0) : (d?.preCount ?? 0);
    }
    bar.news = {
      tone: count ? sum / count : 0,
      count,
      preTone: preCount ? preSum / preCount : 0,
      preCount,
    };
  }
}

/** Sets each bar's days to the next report, and the last report's age and surprise. */
export function attachEarnings(
  bars: StrategyBar[],
  reports: EarningsReport[],
): void {
  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  for (const bar of bars) {
    const day = barDay(bar.timestamp);
    const next = sorted.find((r) => r.date >= day);
    const last = sorted.findLast(
      (r) => r.date <= day && r.surprisePct !== null,
    );
    bar.earnings = {
      daysToNext: next ? daysBetween(day, next.date) : null,
      daysSinceLast: last ? daysBetween(last.date, day) : null,
      lastSurprisePct: last?.surprisePct ?? null,
    };
  }
}
