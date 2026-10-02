import type { BacktestService } from '../backtest/backtest.service.js';
import type { StrategyBar } from '../strategies/strategy.types.js';
import { openedAt, sellLevels } from './broker-levels.js';
import { previewPlan } from './broker-preview.js';
import { INDEX_SYMBOLS, profileById } from './profiles.js';
import { BROKER_STOCKS, SAFE_ASSET } from './universe.js';

const day = (i: number) => new Date(Date.UTC(2025, 0, 1) + i * 86_400_000);
const bars = (symbol: string, closes: number[]): StrategyBar[] =>
  closes.map((close, i) => ({
    symbol,
    timestamp: day(i),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));

describe('sell levels', () => {
  it('finds when the position opened and puts the stop below the high since then', () => {
    const t = (i: number, side: 'buy' | 'sell', qty: number) => ({
      timestamp: day(i),
      symbol: 'NVDA',
      side,
      qty,
      price: 100,
    });
    const trades = [
      t(0, 'buy', 1),
      t(5, 'sell', 1),
      t(10, 'buy', 0.5),
      t(12, 'buy', 0.25),
    ];
    expect(openedAt(trades, 'NVDA')).toEqual(day(10));
    const closes = bars('NVDA', [...Array(10).fill(500), 100, 120, 160, 150]); // the 500s were before this buy
    expect(sellLevels(closes, day(10), 110, { stopPct: '25' })).toEqual({
      highSinceBuy: 160,
      stopPrice: 120,
      takeProfitPrice: null,
    });
    expect(
      sellLevels(closes, day(10), 110, { takeProfitPct: '50' }).takeProfitPrice,
    ).toBeCloseTo(165);
  });
});

describe('plan preview', () => {
  it('turns what it would hold now into amounts, shares and first stops', async () => {
    const n = 300;
    const series = (growth: number, start = 100) =>
      Array.from({ length: n }, (_, i) => start * (1 + growth) ** i);
    const data = Object.fromEntries(
      [...BROKER_STOCKS, SAFE_ASSET].map((s, i) => [
        s,
        bars(
          s,
          s === SAFE_ASSET
            ? series(0.0001, 91)
            : series(
                i < 5 ? 0.004 - i * 0.0005 : -0.001,
                s === 'AAPL' ? 900 : 100,
              ),
        ),
      ]),
    );
    const backtests = {
      fetchBars: vi.fn(async () => data),
    } as unknown as BacktestService;
    const plan = await previewPlan(
      backtests,
      200,
      day(n),
      profileById('aggressive')!,
    );
    expect(plan.rows.map((r) => r.symbol).sort()).toEqual(
      BROKER_STOCKS.slice(0, 5).sort(),
    );
    const aapl = plan.rows.find((r) => r.symbol === 'AAPL');
    expect(aapl?.qty).toBeGreaterThan(0); // fractional: a pricey stock with $200
    expect(aapl?.qty).toBeLessThan(1);
    expect(aapl?.stopPrice).toBeCloseTo((aapl?.price ?? 0) * 0.75);
    expect(aapl?.why).toMatch(/^#\d of 50: up [\d.]+% in 12 months$/);
    expect(plan.rows.reduce((t, r) => t + r.weightPct, 0)).toBeCloseTo(100, 0);
    expect(plan.cash).toBeGreaterThanOrEqual(0);
    expect(plan.cash).toBeLessThan(1);
  });

  it('splits a two-part profile: the strongest stocks and the S&P 500 part', async () => {
    const n = 300;
    const up = (growth: number, start = 100) =>
      Array.from({ length: n }, (_, i) => start * (1 + growth) ** i);
    const data = Object.fromEntries(
      [...BROKER_STOCKS, SAFE_ASSET, ...INDEX_SYMBOLS].map((s, i) => [
        s,
        bars(
          s,
          s === SAFE_ASSET || s === 'SHV'
            ? up(0.0001, 91)
            : up(i < 5 ? 0.004 - i * 0.0005 : 0.0005),
        ),
      ]),
    );
    const backtests = {
      fetchBars: vi.fn(async () => data),
    } as unknown as BacktestService;
    const plan = await previewPlan(
      backtests,
      1_000,
      day(n),
      profileById('careful')!,
    );
    const spy = plan.rows.find((r) => r.symbol === 'SPY');
    expect(spy).toMatchObject({
      weightPct: expect.closeTo(50),
      why: 'the S&P 500 part (the market is above its 200-day average)',
      stopPrice: null,
    });
    expect(
      plan.rows
        .filter((r) => BROKER_STOCKS.includes(r.symbol))
        .reduce((t, r) => t + r.weightPct, 0),
    ).toBeCloseTo(50, 0);
  });
});
