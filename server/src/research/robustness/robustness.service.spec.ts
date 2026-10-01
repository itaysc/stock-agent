import { makeBars } from '../../../test/support/bars.js';
import type { BacktestService } from '../../backtest/backtest.service.js';
import { WalkForwardService } from '../../backtest/walkforward/walkforward.service.js';
import { basketSymbols, listBaskets } from './baskets.js';
import { RobustnessService, summarize } from './robustness.service.js';
import type { SymbolResult } from './robustness.types.js';

// 3 years of wavy prices, different per symbol.
const wave = (shift: number) =>
  Array.from(
    { length: 1_100 },
    (_, i) => 100 + i * 0.03 + 10 * Math.sin((i + shift) / 12),
  );
const all = {
  AAA: makeBars('AAA', wave(0), '2022-01-01'),
  BBB: makeBars('BBB', wave(40), '2022-01-01'),
};

function setup() {
  const fetchBars = vi.fn(async (symbols: string[]) =>
    Object.fromEntries(
      symbols.map((s) => [s, all[s as keyof typeof all] ?? []]),
    ),
  );
  const backtests = {
    fetchBars,
    fetchMarket: async () => ({}),
  } as unknown as BacktestService;
  const walkForwards = new WalkForwardService(backtests);
  const run = vi.spyOn(walkForwards, 'run');
  return {
    service: new RobustnessService(backtests, walkForwards),
    fetchBars,
    run,
  };
}
const request = {
  plan: {
    kind: 'walkforward' as const,
    strategies: ['sma-crossover'],
    params: { fast: '5,10', slow: '30' },
    train: '12m',
    test: '3m',
    sort: 'return-dd' as const,
    minTrades: 0,
    why: '',
  },
  symbols: ['aaa', 'BBB', 'NODATA'],
  timeframe: '1Day',
  from: new Date('2022-01-01'),
  to: new Date('2025-01-01'),
  goal: 'risk-adjusted' as const,
  initialCash: 10_000,
  slippageBps: 5,
  feePerShare: 0,
  cashYieldPct: 3,
};

describe('multi-symbol check', () => {
  it('runs the setup on each symbol on its own, with bars fetched once', async () => {
    const { service, fetchBars, run } = setup();
    const result = await service.run(request);

    expect(fetchBars).toHaveBeenCalledTimes(1);
    expect(result.rows.map((r) => r.symbol)).toEqual(['AAA', 'BBB', 'NODATA']);
    for (const [call, symbol] of [
      [0, 'AAA'],
      [1, 'BBB'],
    ] as const) {
      const [req, bars] = run.mock.calls[call];
      expect(req.symbols).toEqual([symbol]);
      expect(Object.keys(bars ?? {})).toEqual([symbol]); // never the other symbols' bars
    }
    expect(result.rows[0].outcome?.trades).toBeGreaterThan(0);
    expect(result.rows[2]).toMatchObject({
      symbol: 'NODATA',
      error: expect.any(String),
    });
    expect(result.summary.tested).toBe(2);
    expect(result.summary.verdict).toContain('(1 could not run)');
  });

  it('rejects a setup that cannot run', async () => {
    const { service } = setup();
    await expect(
      service.run({
        ...request,
        plan: { ...request.plan, params: { fsat: '5' } },
      }),
    ).rejects.toThrow(/Unknown param fsat/);
    await expect(
      service.run({
        ...request,
        plan: { ...request.plan, train: '12 months' },
      }),
    ).rejects.toThrow(/Invalid duration/);
  });

  it('passes only when it beats holding on at least 60% of the symbols', () => {
    const row = (symbol: string, score: number, ret = 10): SymbolResult => ({
      symbol,
      score,
      outcome: {
        returnPct: ret,
        annualPct: 5,
        holdAnnualPct: 5 - score,
      } as SymbolResult['outcome'],
    });
    const pass = summarize([
      row('A', 1),
      row('B', 0.5),
      row('C', 0.2),
      row('D', -1),
      row('E', -0.1),
    ]);
    expect(pass).toMatchObject({
      tested: 5,
      beatHold: 3,
      passed: true,
      medianScore: 0.2,
      madeMoney: 5,
    });
    expect(pass.verdict).toBe(
      'Better than holding on 3 of 5 symbols: it works on most of them.',
    );
    const fail = summarize([row('A', 1), row('B', -0.5, -3), row('C', -0.2)]);
    expect(fail).toMatchObject({ beatHold: 1, passed: false, madeMoney: 2 });
    expect(summarize([]).passed).toBe(false);
  });

  it('has ready-made baskets', () => {
    expect(listBaskets().map((b) => b.id)).toEqual([
      'megacaps',
      'sectors',
      'indexes',
    ]);
    expect(basketSymbols('indexes', ['spy', 'aapl'])).toEqual([
      'SPY',
      'QQQ',
      'IWM',
      'DIA',
      'AAPL',
    ]);
    expect(basketSymbols(null, ['msft'])).toEqual(['MSFT']);
  });
});
