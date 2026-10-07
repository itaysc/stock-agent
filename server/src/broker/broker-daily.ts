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

/**
 * Each trading day's result, from the investment's daily closing worth. The
 * first day is the day it decided to buy (it buys at the next open): it is
 * the start, at the amount put in (its stored worth is the buys priced at
 * that day's closes, not a real day's result).
 */
export function dailyResults(d: Deployment): DailyResult[] {
  let prev = d.capital;
  return d.snapshots.map((s, i) => {
    const equity = i === 0 ? d.capital : s.equity;
    const pnl = equity - prev;
    const out = {
      date: new Date(s.timestamp).toISOString().slice(0, 10),
      equity,
      pnl,
      pct: prev ? (pnl / prev) * 100 : 0,
    };
    prev = equity;
    return out;
  });
}
