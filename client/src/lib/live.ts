import type { DailyResult, InvestmentView } from '../api/broker-types';

export type LivePrices = Record<string, { price: number; at: string }>;

/**
 * The investment at the latest traded prices: each holding's price, value and
 * gain, and the investment's worth and gain moved by the same change. The
 * broker itself decides on closing prices; this is only what the page shows.
 */
export function applyLive(v: InvestmentView, live: LivePrices): InvestmentView {
  let change = 0;
  const holdings = v.holdings.map((h) => {
    const l = live[h.symbol];
    if (!l || !(l.price > 0)) return h;
    change += h.qty * (l.price - h.price);
    return {
      ...h,
      price: l.price,
      value: h.qty * l.price,
      gainPct: (l.price / h.entryPrice - 1) * 100,
      liveAt: l.at,
    };
  });
  if (!change) return { ...v, holdings };
  const equity = v.equity + change;
  return {
    ...v,
    holdings: holdings.map((h) => ({ ...h, weightPct: (h.value / equity) * 100 })),
    equity,
    pnl: equity - v.capital,
    pnlPct: ((equity - v.capital) / v.capital) * 100,
    daily: withToday(v.daily ?? [], equity, holdings),
  };
}

/** The New York trading day (YYYY-MM-DD) of a time. */
export const nyDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/**
 * The days, plus today so far (from the live prices) while today's close isn't
 * in yet: its change is the live worth against the last close. Marked live.
 */
function withToday(
  days: DailyResult[],
  equity: number,
  holdings: Array<{ liveAt?: string }>,
): DailyResult[] {
  const newest = holdings
    .map((h) => h.liveAt)
    .filter((t): t is string => !!t)
    .sort()
    .at(-1);
  const last = days.at(-1);
  if (!newest || !last) return days;
  const today = nyDay(newest);
  if (today <= last.date) return days;
  const pnl = equity - last.equity;
  return [
    ...days,
    { date: today, equity, pnl, pct: last.equity ? (pnl / last.equity) * 100 : 0, live: true },
  ];
}
