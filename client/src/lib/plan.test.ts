import type { BacktestOptions, SleeveInput } from '../api/types';
import { defaultValues, portfolioBody, researchBody } from './form';
import { formFromPlan } from './plan';
import { runButton } from './runButton';

const param = (name: string) => ({ name, default: 0, min: 0, description: '' });
const options = {
  strategies: [
    { name: 'sma-crossover', description: '', version: 1, params: [param('fast'), param('slow')] },
    {
      name: 'rules',
      description: '',
      version: 1,
      params: [param('trendSma'), param('trailingStop')],
    },
  ],
  timeframes: ['1Day'],
  sortKeys: ['return', 'return-dd'],
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
      goals: ['risk-adjusted'],
      holdout: '12m',
      rounds: 5,
      testsPerRound: 3,
      basket: 'megacaps',
      years: 5,
    },
  },
} as BacktestOptions;

describe('AI-suggested tests and the research agent', () => {
  it('loads a suggested test into the form with the run’s symbols and period', () => {
    const next = formFromPlan(
      defaultValues(options),
      {
        kind: 'walkforward',
        strategies: ['sma-crossover', 'rules'],
        params: { fast: '5,10', trendSma: '100,200' },
        train: '18m',
        test: '6m',
        anchored: true,
        sort: 'return',
        minTrades: 3,
        why: '',
      },
      {
        symbols: ['SPY'],
        from: '2021-01-01',
        to: '2026-01-01',
        timeframe: '1Day',
        initialCash: 50_000,
        slippageBps: 10,
        feePerShare: 0,
      },
      options,
    );
    expect(next).toMatchObject({
      mode: 'walkforward',
      symbols: ['SPY'],
      period: ['2021-01-01', '2026-01-01'],
      specs: { 'sma-crossover': { fast: '5,10' }, rules: { trendSma: '100,200' } },
      train: '18m',
      test: '6m',
      anchored: true,
      wfSort: 'return',
      minTrades: 3,
      cash: 50_000,
      slippageBps: 10,
    });
    expect(runButton(next, options)).toEqual({
      label: 'Run walk-forward · 7 windows',
      blocked: false,
    });
  });

  it('builds the research request and its button', () => {
    const v = { ...defaultValues(options), mode: 'research' as const, rounds: 4, testsPerRound: 2 };
    expect(researchBody(v)).toMatchObject({
      goal: 'risk-adjusted',
      holdout: '12m',
      rounds: 4,
      testsPerRound: 2,
    });
    expect(runButton(v, options)).toEqual({
      label: 'Start AI research · up to 8 tests',
      blocked: false,
    });
    expect(runButton({ ...v, holdout: 'soon' }, options).blocked).toBe(true);
    expect(runButton(v, { ...options, aiEnabled: false }).blocked).toBe(true);
  });

  it('builds the portfolio request and blocks shares above 100%', () => {
    const sleeves: SleeveInput[] = [
      {
        strategy: 'rules',
        symbols: ['AAPL'],
        params: { trendSma: '200', trailingStop: '' },
        weightPct: 60,
      },
      { strategy: 'sma-crossover', symbols: ['SPY'], params: {}, weightPct: 30 },
    ];
    const v = { ...defaultValues(options), mode: 'portfolio' as const, sleeves };
    const body = portfolioBody(v);
    expect(body).toMatchObject({ maxDrawdownPct: 15, cooldownDays: 20, cashYieldPct: 3 });
    expect(body).not.toHaveProperty('symbols');
    expect(body.sleeves[0].params).toEqual({ trendSma: '200' });
    expect(runButton(v, options)).toEqual({ label: 'Run portfolio · 2 sleeves', blocked: false });
    const over = { ...v, sleeves: [...v.sleeves, { ...v.sleeves[1], weightPct: 20 }] };
    expect(runButton(over, options).blocked).toBe(true);
    const empty = { ...v, sleeves: [{ ...v.sleeves[0], symbols: [] }] };
    expect(runButton(empty, options).blocked).toBe(true);
  });
});
