import { makeBars } from '../../test/support/bars.js';
import type { Fill } from '../strategies/strategy.types.js';
import {
  buyAndHoldReturnPct,
  computeMetrics,
  maxDrawdownPct,
} from './backtest-metrics.js';

const curve = (...equity: number[]) =>
  equity.map((e, i) => ({ timestamp: new Date(i * 1000), equity: e }));

const sell = (realizedPnl: number, fee = 0): Fill => ({
  symbol: 'AAPL',
  side: 'sell',
  qty: 1,
  price: 100,
  fee,
  timestamp: new Date(0),
  realizedPnl,
});

describe('backtest metrics', () => {
  it('measures the largest peak-to-trough drawdown', () => {
    // Peak 120 → trough 90 is -25%; the later dip 130 → 117 is only -10%.
    expect(maxDrawdownPct(curve(100, 120, 90, 130, 117))).toBeCloseTo(25);
    expect(maxDrawdownPct(curve(100, 110, 120))).toBe(0);
  });

  it('computes return, win rate, profit factor and fees', () => {
    const fills: Fill[] = [
      { ...sell(0), side: 'buy', realizedPnl: undefined, fee: 1 },
      sell(300, 1),
      sell(-100, 1),
      sell(50, 1),
    ];
    const m = computeMetrics(10_000, curve(10_000, 10_250), fills, {});

    expect(m.totalReturnPct).toBeCloseTo(2.5);
    expect(m.trades).toBe(3);
    expect(m.winRatePct).toBeCloseTo(66.67, 1);
    expect(m.profitFactor).toBeCloseTo(3.5); // 350 / 100
    expect(m.totalFees).toBe(4);
  });

  it('returns null ratios when there is nothing to divide by', () => {
    const m = computeMetrics(10_000, curve(10_000), [sell(10)], {});
    expect(m.profitFactor).toBeNull(); // no losing trades
    expect(computeMetrics(10_000, [], [], {}).winRatePct).toBeNull();
  });

  it('benchmarks against equal-weight buy & hold (first open → last close)', () => {
    const result = buyAndHoldReturnPct({
      AAPL: makeBars('AAPL', [[100, 101], 105, 110]), // +10%
      MSFT: makeBars('MSFT', [[200, 200], 190]), // -5%
    });
    expect(result).toBeCloseTo(2.5);
    expect(buyAndHoldReturnPct({})).toBeNull();
  });
});
