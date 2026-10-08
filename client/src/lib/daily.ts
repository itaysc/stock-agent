import type { DailyResult } from '../api/broker-types';

/**
 * Several investments' days added up: each day's change in dollars summed,
 * and as a share of what they were worth together the day before.
 */
export function combineDays(lists: DailyResult[][]): DailyResult[] {
  const byDate = new Map<string, { equity: number; pnl: number; live: boolean }>();
  for (const list of lists)
    for (const d of list) {
      const x = byDate.get(d.date) ?? { equity: 0, pnl: 0, live: false };
      byDate.set(d.date, {
        equity: x.equity + d.equity,
        pnl: x.pnl + d.pnl,
        live: x.live || !!d.live,
      });
    }
  return [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { equity, pnl, live }]) => {
      const before = equity - pnl;
      return {
        date,
        equity,
        pnl,
        pct: before ? (pnl / before) * 100 : 0,
        ...(live ? { live } : {}),
      };
    });
}
