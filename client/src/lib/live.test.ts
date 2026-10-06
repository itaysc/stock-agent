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
