import { makeBars } from '../../test/support/bars.js';
import { runBacktest } from '../backtest/backtest-engine.js';
import { RsiReversionStrategy } from './rsi-reversion.strategy.js';
import {
  createStrategy,
  describeStrategies,
  strategyParamNames,
} from './strategy-registry.js';

const options = { initialCash: 10_000, slippageBps: 0, feePerShare: 0 };
const strategy = (trend = 0) =>
  new RsiReversionStrategy({
    symbols: ['AAPL'],
    period: 3,
    oversold: 30,
    overbought: 70,
    trend,
    allocation: 1,
  });

// Rises, dips hard (oversold), then rallies (overbought).
const dipThenRally = [10, 11, 12, 13, 12, 10, 8, 9, 11, 13, 15, 16];

describe('RsiReversionStrategy', () => {
  it('buys the oversold dip and sells the overbought rally', () => {
    const result = runBacktest(
      strategy(),
      { AAPL: makeBars('AAPL', dipThenRally) },
      options,
    );
    expect(result.fills.map((f) => f.side)).toEqual(['buy', 'sell']);
    expect(result.fills[0].reason).toMatch(/^RSI \d+ < 30$/);
    expect(result.fills[1].reason).toMatch(/^RSI \d+ > 70$/);
    expect(result.fills[1].price).toBeGreaterThan(result.fills[0].price);
  });

  it('skips dips when the price is below the trend average', () => {
    // A steady decline: oversold, but never in an uptrend.
    const falling = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9];
    const noFilter = runBacktest(
      strategy(0),
      { AAPL: makeBars('AAPL', falling) },
      options,
    );
    const filtered = runBacktest(
      strategy(5),
      { AAPL: makeBars('AAPL', falling) },
      options,
    );
    expect(noFilter.fills.length).toBeGreaterThan(0);
    expect(filtered.fills).toEqual([]);
  });

  it('needs enough bars for both RSI and the trend filter', () => {
    expect(strategy(0).warmupBars).toBe(4);
    expect(strategy(200).warmupBars).toBe(200);
  });

  it('rejects invalid params', () => {
    const make = (over: Record<string, string>) => () =>
      createStrategy('rsi-reversion', ['AAPL'], over);
    expect(make({ oversold: '80' })).toThrow(
      /oversold must be less than overbought/,
    );
    expect(make({ period: '1' })).toThrow(/period/);
    expect(make({ trend: '2.5' })).toThrow(/trend/);
  });
});

describe('strategy registry', () => {
  it('lists each strategy with its params and defaults', () => {
    expect(strategyParamNames('rsi-reversion')).toEqual([
      'period',
      'oversold',
      'overbought',
      'trend',
      'allocation',
    ]);
    const help = describeStrategies();
    expect(help).toContain('sma-crossover');
    expect(help).toContain(
      'params: period=14 oversold=30 overbought=70 trend=200',
    );
  });

  it('ignores params that belong to another strategy', () => {
    expect(() =>
      createStrategy('rsi-reversion', ['AAPL'], { fast: '10' }),
    ).not.toThrow();
  });
});
