import { makeBars } from '../../../test/support/bars.js';
import { createStrategy } from '../../strategies/strategy-registry.js';
import { runBacktest } from '../backtest-engine.js';
import type { BacktestService } from '../backtest.service.js';
import { sortRows } from '../sweep/sweep-report.js';
import type { SweepRow } from '../sweep/sweep.service.js';
import { WalkForwardService } from './walkforward.service.js';
import type { WalkForwardRequest } from './walkforward.types.js';

// ~2 years of daily bars with changing wave lengths (so different settings win at different times).
const closes = Array.from(
  { length: 730 },
  (_, i) => 100 + 15 * Math.sin(i / (6 + (i % 200) / 40)) + i * 0.02,
);
const bars = { AAPL: makeBars('AAPL', closes, '2023-01-01') };
const options = { initialCash: 10_000, slippageBps: 0, feePerShare: 0 };

function setup(over: Partial<WalkForwardRequest> = {}) {
  const service = new WalkForwardService({
    fetchBars: async () => bars,
    fetchMarket: async () => ({}),
  } as unknown as BacktestService);
  const request: WalkForwardRequest = {
    strategies: ['sma-crossover'],
    grid: { fast: ['3', '5', '8'], slow: ['10', '20', '5'] }, // slow=5 makes some combos invalid
    symbols: ['AAPL'],
    timeframe: '1Day',
    from: new Date('2023-01-01'),
    to: new Date('2025-01-01'),
    train: '6m',
    test: '3m',
    sort: 'return',
    ...options,
    ...over,
  };
  return { service, request };
}

describe('WalkForwardService', () => {
  it('chains test windows: each starts with the money the previous one ended with', async () => {
    const { service, request } = setup();
    const result = await service.run(request);

    expect(result.windows.length).toBe(6); // 24 months: 6 train, then 6 × 3 months of tests
    expect(result.oosFrom).toEqual(new Date('2023-07-01'));
    for (let i = 1; i < result.windows.length; i++) {
      expect(result.windows[i].test?.startEquity).toBeCloseTo(
        result.windows[i - 1].test?.endEquity ?? NaN,
      );
    }
    expect(result.finalEquity).toBeCloseTo(
      result.windows.at(-1)?.test?.endEquity ?? NaN,
    );
    expect(result.metrics.totalReturnPct).toBeCloseTo(
      (result.finalEquity / 10_000 - 1) * 100,
    );
    expect(result.fills.every((f) => f.timestamp >= result.oosFrom)).toBe(true);
    expect(result.equityCurve[0].timestamp.getTime()).toBeGreaterThanOrEqual(
      result.oosFrom.getTime(),
    );
  });

  it('picks the best training setting (matches an independent sweep on training data)', async () => {
    const { service, request } = setup();
    const result = await service.run(request);

    for (const w of result.windows) {
      // Independent re-run that is only given bars up to the end of training.
      const known = { AAPL: bars.AAPL.filter((b) => b.timestamp < w.trainTo) };
      const rows: SweepRow[] = [];
      for (const fast of ['3', '5', '8']) {
        for (const slow of ['10', '20', '5']) {
          try {
            const run = runBacktest(
              createStrategy('sma-crossover', ['AAPL'], { fast, slow }),
              known,
              options,
              { startAt: w.trainFrom, closeAtEnd: true },
            );
            rows.push({
              strategy: 'sma-crossover',
              params: { fast, slow },
              metrics: run.metrics,
              finalEquity: 0,
              openPositions: 0,
              equity: [],
            });
          } catch {
            // invalid combo
          }
        }
      }
      expect(w.chosen?.params).toEqual(sortRows(rows, 'return')[0].params);
      expect(w.candidates).toBe(7); // 9 combos minus 2 with fast >= slow (5/5, 8/5)
    }
  });

  it('reports efficiency and parameter stability', async () => {
    const { service, request } = setup();
    const result = await service.run(request);
    expect(result.distinctSettings).toBeGreaterThanOrEqual(1);
    expect(result.paramChanges).toBeLessThan(result.windows.length);
    expect(result.buyAndHold).toHaveLength(result.equityCurve.length);
    if (result.efficiencyPct !== null) {
      expect(result.efficiencyPct).toBeCloseTo(
        ((result.outOfSampleAnnualPct ?? 0) / (result.inSampleAnnualPct ?? 1)) *
          100,
      );
    }
  });

  it('falls back to all settings when none has enough trades', async () => {
    const { service, request } = setup({ minTrades: 10_000 });
    const result = await service.run(request);
    expect(
      result.windows.every((w) => w.qualified === 0 && w.chosen !== null),
    ).toBe(true);
  });

  it('rejects a period too short for one window, and unknown params', async () => {
    const short = setup({ to: new Date('2023-05-01') });
    await expect(short.service.run(short.request)).rejects.toThrow(/too short/);
    const typo = setup({ grid: { fsat: ['3'] } });
    await expect(typo.service.run(typo.request)).rejects.toThrow(
      /Unknown param fsat/,
    );
  });
});
