import { makeBars } from '../../../test/support/bars.js';
import type { BacktestService } from '../backtest.service.js';
import { walkForwardFacts } from '../summary/walkforward-facts.js';
import { chartData, renderWalkForwardHtml } from './html/walkforward-html.js';
import { formatWalkForward, walkForwardSetup } from './walkforward-report.js';
import { WalkForwardService } from './walkforward.service.js';

const closes = Array.from(
  { length: 400 },
  (_, i) => 100 + 12 * Math.sin(i / 8) + i * 0.05,
);
const bars = { AAPL: makeBars('AAPL', closes, '2023-01-01') };

async function run() {
  const service = new WalkForwardService({
    fetchBars: async () => bars,
    fetchMarket: async () => ({}),
  } as unknown as BacktestService);
  return service.run({
    strategies: ['sma-crossover'],
    grid: { fast: ['3', '5'], slow: ['10', '20'] },
    symbols: ['AAPL'],
    timeframe: '1Day',
    from: new Date('2023-01-01'),
    to: new Date('2024-01-01'),
    train: '6m',
    test: '2m',
    anchored: true,
    sort: 'return-dd',
    minTrades: 1,
    initialCash: 10_000,
    slippageBps: 5,
    feePerShare: 0,
  });
}

describe('walk-forward reports', () => {
  it('describes the setup and every window in the text report', async () => {
    const result = await run();
    expect(walkForwardSetup(result)).toBe(
      'train 6 months, test 2 months (anchored), best by return-dd, min 1 trades',
    );
    const text = formatWalkForward(result);
    expect(text).toContain(
      'Unseen data   2023-07-01 → 2024-01-01 (3 test windows)',
    );
    expect(text).toMatch(/win rate \d/); // no "+" sign on a rate
    expect(text.split('\n').filter((l) => /^ {1,2}\d  /.test(l))).toHaveLength(
      3,
    );
  });

  it('renders the HTML report with a marker per test window', async () => {
    const result = await run();
    const data = chartData(result);
    expect(data.times).toHaveLength(result.equityCurve.length);
    expect(data.windowStarts.map((w) => w.label)).toEqual(['W1', 'W2', 'W3']);

    const html = renderWalkForwardHtml(result, null, '/* chart lib */');
    expect(html).toContain(
      '<title>Walk-forward: sma-crossover on AAPL</title>',
    );
    expect(html).toContain('Equity on unseen data');
    expect(html.match(/<tr><td>W\d/g)).toHaveLength(3);
  });

  it('gives the AI the costs and that positions are closed per window', async () => {
    const facts = walkForwardFacts(await run());
    expect(facts).toContain('Costs: slippage 5 bps per fill');
    expect(facts).toContain('nothing is left open');
    expect(facts).toContain('#3 train 2023-01-01..2023-11-01');
  });
});
