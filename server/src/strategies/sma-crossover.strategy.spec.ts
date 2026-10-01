import { makeBars } from '../../test/support/bars.js';
import { runBacktest } from '../backtest/backtest-engine.js';
import { SmaCrossoverStrategy } from './sma-crossover.strategy.js';
import { createStrategy } from './strategy-registry.js';

const options = { initialCash: 10_000, slippageBps: 0, feePerShare: 0 };

describe('SmaCrossoverStrategy', () => {
  // Down, then a rally (fast crosses above slow), then a drop (crosses below).
  const prices = [10, 9, 8, 7, 6, 7, 9, 12, 15, 18, 16, 12, 8, 5, 4];
  const strategy = () =>
    new SmaCrossoverStrategy({
      symbols: ['AAPL'],
      fast: 2,
      slow: 4,
      allocation: 1,
    });

  it('buys on the upward cross and sells on the downward cross', () => {
    const result = runBacktest(
      strategy(),
      { AAPL: makeBars('AAPL', prices) },
      options,
    );

    expect(result.fills.map((f) => f.side)).toEqual(['buy', 'sell']);
    expect(result.fills[0].reason).toMatch(/crossed above/);
    expect(result.fills[1].reason).toMatch(/crossed below/);
    expect(result.openPositions).toEqual([]);
  });

  it('does not trade before the slow average has enough bars', () => {
    const result = runBacktest(
      strategy(),
      { AAPL: makeBars('AAPL', [1, 2, 3]) },
      options,
    );
    expect(result.fills).toEqual([]);
  });

  it('rejects invalid params', () => {
    expect(
      () =>
        new SmaCrossoverStrategy({
          symbols: ['AAPL'],
          fast: 50,
          slow: 20,
          allocation: 1,
        }),
    ).toThrow(/fast must be shorter/);
    expect(() =>
      createStrategy('sma-crossover', ['AAPL'], { allocation: '2' }),
    ).toThrow(/allocation/);
  });
});

describe('createStrategy', () => {
  it('rejects unknown strategies and missing symbols', () => {
    expect(() => createStrategy('nope', ['AAPL'])).toThrow(
      /Available: sma-crossover/,
    );
    expect(() => createStrategy('sma-crossover', [])).toThrow(/symbol/);
    expect(() =>
      createStrategy('sma-crossover', ['AAPL'], { fast: 'x' }),
    ).toThrow(/fast must be a number/);
  });
});
