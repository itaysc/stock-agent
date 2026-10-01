import type { BacktestOptions } from '../api/types';
import { backtestBody, defaultValues, sweepBody, walkForwardBody } from './form';

const options = {
  strategies: [
    { name: 'sma-crossover', description: '', version: 1, params: [] },
    { name: 'rsi-reversion', description: '', version: 1, params: [] },
  ],
  timeframes: ['1Day'],
  sortKeys: ['return'],
  maxCombinations: 2000,
  dataFeed: 'iex',
  dataStart: '2020-07-27',
  aiEnabled: true,
  baskets: [],
  defaults: {
    timeframe: '1Day',
    cash: 100_000,
    slippageBps: 5,
    feePerShare: 0,
    cashYieldPct: 3,
    years: 2,
    walkForward: { train: '12m', test: '3m', sort: 'return-dd', years: 5 },
    research: {
      goals: ['risk-adjusted', 'beat-hold', 'return'],
      holdout: '12m',
      rounds: 5,
      testsPerRound: 3,
      basket: 'megacaps',
      years: 5,
    },
  },
} as BacktestOptions;

describe('form → request body', () => {
  it('starts from the server defaults with a 2-year period', () => {
    const v = defaultValues(options);
    expect(v).toMatchObject({
      mode: 'backtest',
      strategy: 'sma-crossover',
      cash: 100_000,
      ai: true,
    });
    const [from, to] = v.period.map((d) => new Date(d as string).getFullYear());
    expect((to as number) - (from as number)).toBe(2);
  });

  it('sends only filled-in params for a backtest', () => {
    const v = {
      ...defaultValues(options),
      params: { 'sma-crossover': { fast: '10', slow: '' } },
    };
    expect(backtestBody(v)).toMatchObject({
      strategy: 'sma-crossover',
      params: { fast: '10' },
      symbols: ['AAPL', 'MSFT'],
      fresh: false,
    });
  });

  it('merges each selected strategy’s sweep specs', () => {
    const v = {
      ...defaultValues(options),
      mode: 'sweep' as const,
      strategies: ['sma-crossover', 'rsi-reversion'],
      specs: {
        'sma-crossover': { fast: '5..30:5', slow: '' },
        'rsi-reversion': { oversold: '25,30' },
        other: { ignored: '1' },
      },
    };
    expect(sweepBody(v)).toMatchObject({
      strategies: ['sma-crossover', 'rsi-reversion'],
      params: { fast: '5..30:5', oversold: '25,30' },
      sort: 'return',
    });
  });

  it('sends walk-forward windows and its own pick-best key', () => {
    const v = {
      ...defaultValues(options),
      mode: 'walkforward' as const,
      specs: { 'sma-crossover': { fast: '5,10' } },
      train: ' 2y ',
      anchored: true,
    };
    expect(walkForwardBody(v)).toMatchObject({
      strategies: ['sma-crossover'],
      params: { fast: '5,10' },
      train: '2y',
      test: '3m',
      anchored: true,
      sort: 'return-dd',
    });
  });
});
