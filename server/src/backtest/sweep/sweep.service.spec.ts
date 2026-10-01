import { makeBars } from '../../../test/support/bars.js';
import type { BacktestService } from '../backtest.service.js';
import {
  filterMinTrades,
  formatSweep,
  sortRows,
  toCsv,
} from './sweep-report.js';
import { type SweepRequest, SweepService } from './sweep.service.js';

// A wave, so the SMA crossover trades several times at short settings.
const wave = Array.from({ length: 120 }, (_, i) => 100 + 20 * Math.sin(i / 6));

function setup() {
  const fetchBars = vi.fn(async (symbols: string[]) =>
    Object.fromEntries(symbols.map((s) => [s, makeBars(s, wave)])),
  );
  const service = new SweepService({
    fetchBars,
    fetchMarket: async () => ({}),
  } as unknown as BacktestService);
  return { service, fetchBars };
}

const request = (over: Partial<SweepRequest> = {}): SweepRequest => ({
  strategies: ['sma-crossover'],
  grid: { fast: ['3', '5', '30'], slow: ['10', '20'] },
  symbols: ['aapl'],
  timeframe: '1Day',
  from: new Date('2025-01-01'),
  to: new Date('2025-06-01'),
  initialCash: 10_000,
  slippageBps: 0,
  feePerShare: 0,
  ...over,
});

describe('SweepService', () => {
  it('runs every valid combination on bars fetched once', async () => {
    const { service, fetchBars } = setup();
    const result = await service.run(request());

    expect(fetchBars).toHaveBeenCalledTimes(1);
    expect(result.rows).toHaveLength(4); // 3 × 2, minus fast=30 (>= slow)
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0].error).toMatch(/fast must be less than slow/);
    expect(result.symbols).toEqual(['AAPL']);
    expect(result.bars).toBe(120);
    expect(result.rows.every((r) => r.metrics.trades > 0)).toBe(true);
  });

  it('compares strategies, applying each param only where it exists', async () => {
    const { service } = setup();
    const result = await service.run(
      request({
        strategies: ['sma-crossover', 'rsi-reversion'],
        grid: { fast: ['3', '5'], trend: ['0'] },
      }),
    );
    const byStrategy = (name: string) =>
      result.rows.filter((r) => r.strategy === name);
    expect(byStrategy('sma-crossover').map((r) => r.params)).toEqual([
      { fast: '3' },
      { fast: '5' },
    ]);
    expect(byStrategy('rsi-reversion').map((r) => r.params)).toEqual([
      { trend: '0' },
    ]);
  });

  it('rejects params no selected strategy has, and unknown strategies', async () => {
    const { service, fetchBars } = setup();
    await expect(
      service.run(request({ grid: { fsat: ['1'] } })),
    ).rejects.toThrow(/Unknown param fsat/);
    await expect(
      service.run(request({ strategies: ['nope'] })),
    ).rejects.toThrow(/Unknown strategy/);
    expect(fetchBars).not.toHaveBeenCalled();
  });
});

describe('sweep report', () => {
  it('ranks, summarizes and exports', async () => {
    const { service } = setup();
    const result = await service.run(request());

    const byReturn = sortRows(result.rows, 'return').map(
      (r) => r.metrics.totalReturnPct,
    );
    expect(byReturn).toEqual([...byReturn].sort((a, b) => b - a));

    const text = formatSweep(result, 'return', 2);
    expect(text).toContain('4 backtests on AAPL');
    expect(text).toContain('... 2 more (use --top)');
    expect(text).toMatch(
      /sma-crossover: median return .*, \d\/4 positive, \d\/4 beat buy & hold/,
    );
    expect(text).toContain('Skipped 2 invalid combinations');

    const csv = toCsv(result).trim().split('\n');
    expect(csv[0]).toBe(
      'strategy,fast,slow,return_pct,max_drawdown_pct,trades,win_rate_pct,profit_factor,final_equity',
    );
    expect(csv).toHaveLength(5);

    const { result: kept, hidden } = filterMinTrades(result, 1_000);
    expect(kept.rows).toEqual([]);
    expect(hidden).toBe(4);
  });
});
