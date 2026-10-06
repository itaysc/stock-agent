import type { InvestmentView } from '../api/broker-types';

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
  };
}
