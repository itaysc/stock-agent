import { makeBars } from '../../../../test/support/bars.js';
import type { BacktestService } from '../../backtest.service.js';
import { type SweepRequest, SweepService } from '../sweep.service.js';
import { strategyChartSvg, variedParams } from './sweep-heatmap-svg.js';
import { buildSweepHtml } from './sweep-html.js';
import { buildSweepHtmlData, TOP_CURVES } from './sweep-html-data.js';
import { niceTicks, scatterSvg } from './sweep-scatter-svg.js';

const wave = Array.from({ length: 120 }, (_, i) => 100 + 20 * Math.sin(i / 6));
const ctx = { from: '2025-01-01', to: '2025-06-01', timeframe: '1Day' };

async function sweep(over: Partial<SweepRequest> = {}) {
  const fetchBars = async (symbols: string[]) =>
    Object.fromEntries(symbols.map((s) => [s, makeBars(s, wave)]));
  const service = new SweepService({
    fetchBars,
    fetchMarket: async () => ({}),
  } as unknown as BacktestService);
  return service.run({
    strategies: ['sma-crossover'],
    grid: { fast: ['3', '5', '8'], slow: ['10', '20'] },
    symbols: ['AAPL'],
    timeframe: '1Day',
    from: new Date('2025-01-01'),
    to: new Date('2025-06-01'),
    initialCash: 10_000,
    slippageBps: 0,
    feePerShare: 0,
    ...over,
  });
}

describe('sweep html data', () => {
  it('ranks runs, flags beat-buy-&-hold and builds report commands', async () => {
    const result = await sweep();
    const data = buildSweepHtmlData(result, 'return', ctx);

    expect(data.runs.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    const returns = data.runs.map((r) => r.returnPct);
    expect(returns).toEqual([...returns].sort((a, b) => b - a));
    for (const r of data.runs) {
      expect(r.beatHold).toBe(
        r.returnPct > (data.buyAndHoldReturnPct ?? Infinity),
      );
    }
    expect(data.runs[0].command).toBe(
      `npm run report -- AAPL --strategy sma-crossover --param fast=${data.runs[0].params.fast}` +
        ` --param slow=${data.runs[0].params.slow} --from 2025-01-01 --to 2025-06-01 --timeframe 1Day`,
    );
    expect(data.summaries).toEqual([
      expect.objectContaining({ strategy: 'sma-crossover', runs: 6 }),
    ]);
  });

  it('keeps equity curves for the top runs only, aligned with time', async () => {
    const data = buildSweepHtmlData(await sweep(), 'return', ctx);
    expect(data.curves.top).toHaveLength(TOP_CURVES);
    expect(data.curves.times).toHaveLength(120);
    expect(data.curves.buyAndHold).toHaveLength(120);
    expect(data.curves.buyAndHold[0]).toBeCloseTo(10_000);
    for (const c of data.curves.top) expect(c.values).toHaveLength(120);
  });
});

describe('sweep charts', () => {
  it('draws a heatmap for 2 swept params, bars for 1, nothing for 3+', async () => {
    const two = buildSweepHtmlData(await sweep(), 'return', ctx).runs;
    expect(variedParams(two)).toEqual(['fast', 'slow']);
    const grid = strategyChartSvg(two) ?? '';
    expect(grid.match(/<g class="cell/g)).toHaveLength(6);
    expect(grid).toContain('>fast<');

    const one = buildSweepHtmlData(
      await sweep({ grid: { fast: ['3', '5'] } }),
      'return',
      ctx,
    ).runs;
    expect(strategyChartSvg(one)).toMatch(/aria-label="Return by fast"/);

    const three = buildSweepHtmlData(
      await sweep({
        grid: {
          fast: ['3', '5'],
          slow: ['10', '20'],
          allocation: ['0.5', '1'],
        },
      }),
      'return',
      ctx,
    ).runs;
    expect(strategyChartSvg(three)).toBeNull();
  });

  it('picks round axis ticks and plots one dot per run', async () => {
    expect(niceTicks(0, 22)).toEqual([0, 5, 10, 15, 20]);
    expect(niceTicks(-12, 38)).toEqual([-10, 0, 10, 20, 30]);
    const runs = buildSweepHtmlData(await sweep(), 'return', ctx).runs;
    const svg = scatterSvg(runs, 12.5, ['sma-crossover']);
    expect(svg.match(/<circle/g)).toHaveLength(runs.length);
    expect(svg).toContain('Buy &amp; hold +12.5%');
  });
});

describe('buildSweepHtml', () => {
  it('produces a self-contained page with every section', async () => {
    const html = await buildSweepHtml(await sweep(), 'return', ctx);
    expect(html).toContain('<title>Sweep: sma-crossover on AAPL</title>');
    for (const text of [
      'return by setting',
      'Return vs. drawdown',
      'equity curves',
      'All runs',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('function renderSweep(');
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it('explains when too many params are swept for a heatmap', async () => {
    const html = await buildSweepHtml(
      await sweep({
        grid: {
          fast: ['3', '5'],
          slow: ['10', '20'],
          allocation: ['0.5', '1'],
        },
      }),
      'return',
      ctx,
    );
    expect(html).toContain('this sweep varies 3 (fast, slow, allocation)');
  });
});
