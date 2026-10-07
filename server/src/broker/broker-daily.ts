import type { Deployment } from '../paper/deployment.types.js';

/** One trading day of an investment: its worth at the close and the change from the day before. */
export interface DailyResult {
  /** The trading day, YYYY-MM-DD. */
  date: string;
  equity: number;
  /** Change from the previous close (the first day: from the amount put in). */
  pnl: number;
  pct: number;
}

/** Each trading day's result, from the investment's daily closing worth. */
export function dailyResults(d: Deployment): DailyResult[] {
  let prev = d.capital;
  return d.snapshots.map((s) => {
    const pnl = s.equity - prev;
    const out = {
      date: new Date(s.timestamp).toISOString().slice(0, 10),
      equity: s.equity,
      pnl,
      pct: prev ? (pnl / prev) * 100 : 0,
    };
    prev = s.equity;
    return out;
  });
}
