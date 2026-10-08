import type { InvestmentView } from '../api/broker-types';
import { applyLive } from './live';

const view = {
  capital: 1000,
  equity: 1000,
  pnl: 0,
  pnlPct: 0,
  holdings: [
    { symbol: 'AAA', qty: 2, price: 100, entryPrice: 100, value: 200, weightPct: 20, gainPct: 0 },
    { symbol: 'BBB', qty: 1, price: 50, entryPrice: 40, value: 50, weightPct: 5, gainPct: 25 },
  ],
} as unknown as InvestmentView;

describe('applyLive', () => {
  it('moves each holding and the investment by the live prices', () => {
    const v = applyLive(view, { AAA: { price: 110, at: '2026-10-05T14:30:00Z' } });
    const aaa = v.holdings[0];
    expect(aaa).toMatchObject({ price: 110, value: 220, liveAt: '2026-10-05T14:30:00Z' });
    expect(aaa.gainPct).toBeCloseTo(10);
    expect(v.equity).toBe(1020); // +2 × $10
    expect(v.pnl).toBe(20);
    expect(v.pnlPct).toBeCloseTo(2);
    // No live price: the last close stays (only its share of the total moves).
    expect(v.holdings[1]).toMatchObject({ price: 50, gainPct: 25 });
    expect(v.holdings[1].liveAt).toBeUndefined();
  });

  it('changes nothing without live prices', () => {
    expect(applyLive(view, {}).equity).toBe(1000);
  });
});

describe('applyLive: today so far in the calendar', () => {
  const withDays = {
    ...view,
    daily: [{ date: '2026-10-06', equity: 1000, pnl: 5, pct: 0.5 }],
  } as unknown as InvestmentView;

  it('adds today from the live prices while its close is not in yet', () => {
    // 14:30 UTC on Oct 7 = 10:30 in New York.
    const v = applyLive(withDays, { AAA: { price: 110, at: '2026-10-07T14:30:00Z' } });
    expect(v.daily.at(-1)).toEqual({
      date: '2026-10-07',
      equity: 1020,
      pnl: 20,
      pct: 2,
      live: true,
    });
  });

  it('adds nothing once that day is in (or the live trade is from the last close day)', () => {
    const v = applyLive(withDays, { AAA: { price: 110, at: '2026-10-06T19:59:00Z' } });
    expect(v.daily).toHaveLength(1);
  });
});
