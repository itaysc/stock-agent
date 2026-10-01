import { makeBars } from '../../../test/support/bars.js';
import { runBacktest } from '../../backtest/backtest-engine.js';
import { createStrategy } from '../strategy-registry.js';
import { usesMarket } from './rules-validate.js';

const options = { initialCash: 10_000, slippageBps: 0, feePerShare: 0 };
const off = { breakout: '0', trailingStop: '0' };
function run(
  params: Record<string, string>,
  closes: number[],
  extra: { volumes?: Record<number, number>; spy?: number[] } = {},
) {
  const bars = makeBars('AAPL', closes);
  for (const [i, v] of Object.entries(extra.volumes ?? {}))
    bars[Number(i)].volume = v;
  return runBacktest(
    createStrategy('rules', ['AAPL'], { allocation: '1', ...params }),
    { AAPL: bars },
    options,
    { market: extra.spy ? { SPY: makeBars('SPY', extra.spy) } : {} },
  );
}
const reasons = (r: ReturnType<typeof run>) =>
  r.fills.map((f) => `${f.side}: ${f.reason}`);

describe('rules building blocks (trading-signals indicators)', () => {
  it('MACD: buys when momentum turns up and sells when it turns down', () => {
    const closes = [
      30, 29, 28, 27, 26, 25, 24, 23, 22, 23, 25, 27, 29, 31, 33, 32, 30, 28,
      26, 24,
    ];
    const r = run(
      {
        ...off,
        macdCross: '1',
        macdExit: '1',
        macdFast: '3',
        macdSlow: '6',
        macdSignal: '3',
      },
      closes,
    );
    expect(reasons(r)).toEqual(['buy: MACD cross up', 'sell: MACD cross down']);
    expect(r.fills[1].price).toBeGreaterThan(r.fills[0].price);
  });

  it('ATR stop: sells on a drop of more than N average ranges below the recent high', () => {
    const r = run(
      { breakout: '3', trailingStop: '0', atrStop: '1', atrPeriod: '3' },
      [10, 10, 10, 10, 12, 13, 14, 15, 16, 12, 11],
    );
    expect(reasons(r)).toEqual(['buy: 3-bar breakout', 'sell: ATR stop 1×']);
  });

  it('volume filter: only takes the breakout that comes with heavy volume', () => {
    const r = run(
      { breakout: '3', volumeRatio: '2', volumePeriod: '3' },
      [10, 10, 10, 10, 12, 12, 12, 12, 14, 14],
      { volumes: { 8: 3_000 } }, // every other bar: 1,000
    );
    expect(r.fills[0]).toMatchObject({
      side: 'buy',
      price: 14,
      reason: '3-bar breakout + volume 3.0× normal',
    });
  });

  it('market filter: buys only while SPY is above its average, sells when it falls below', () => {
    const r = run(
      { breakout: '3', trailingStop: '10', marketSma: '3', marketExit: '1' },
      [10, 10, 10, 10, 11, 12, 13, 14, 15, 16, 17, 18], // a breakout every bar from bar 4
      { spy: [100, 99, 98, 97, 96, 95, 100, 105, 110, 100, 90, 80] }, // turns up at bar 6, down at bar 9
    );
    expect(reasons(r)).toEqual([
      'buy: 3-bar breakout + market above 3-bar average',
      'sell: market below 3-bar average',
    ]);
    expect(r.fills.map((f) => f.price)).toEqual([13, 16]);
    // SPY is market data only: not traded, not part of buy & hold.
    expect(r.fills.every((f) => f.symbol === 'AAPL')).toBe(true);
    expect(r.metrics.buyAndHoldReturnPct).toBeCloseTo(80);
  });

  it('Bollinger bands: buys a close under the lower band', () => {
    const r = run(
      { ...off, bbPeriod: '5', bbStd: '1', takeProfit: '5' },
      [10, 10, 10, 10, 10, 9, 9.5, 10, 10.5, 11],
    );
    expect(reasons(r)).toEqual([
      'buy: below lower Bollinger band',
      'sell: take-profit 5%',
    ]);
  });

  it('rejects MACD and market settings that cannot work', () => {
    const make = (params: Record<string, string>) => () =>
      createStrategy('rules', ['AAPL'], params);
    expect(make({ macdCross: '1', macdFast: '26', macdSlow: '12' })).toThrow(
      /macdFast must be less than macdSlow/,
    );
    expect(make({ marketExit: '1' })).toThrow(/marketExit needs marketSma/);
    expect(make({ macdCross: '2' })).toThrow(
      /macdCross must be between 0 and 1/,
    );
  });

  it('knows when a run needs SPY data', () => {
    expect(usesMarket(['rules'], { marketSma: ['0', '200'] })).toBe(true);
    expect(usesMarket(['rules'], { marketSma: '0' })).toBe(false);
    expect(usesMarket(['rules'], {})).toBe(false);
    expect(usesMarket(['sma-crossover'], { marketSma: ['200'] })).toBe(false);
  });
});
