import { makeBars } from '../../../test/support/bars.js';
import type { Strategy } from '../../strategies/strategy.types.js';
import { runBacktest } from '../backtest-engine.js';
import { buildHtmlReport } from './html-report.js';
import {
  buildReportData,
  buyAndHoldCurve,
  drawdownCurve,
} from './report-data.js';

function sampleRun(reason = 'signal') {
  const bars = {
    AAPL: makeBars('AAPL', [[100, 100], 110, 120, 90]),
    MSFT: makeBars('MSFT', [[50, 50], 50, 55, 60]),
  };
  let i = 0;
  const strategy: Strategy = {
    name: 'test',
    symbols: ['AAPL', 'MSFT'],
    onBar: (bar, ctx) => {
      if (bar.symbol !== 'AAPL') return;
      if (i === 0) ctx.buy('AAPL', 10, reason);
      if (i === 2) ctx.sell('AAPL', 10, reason);
      i++;
    },
  };
  const result = runBacktest(strategy, bars, {
    initialCash: 10_000,
    slippageBps: 0,
    feePerShare: 0,
  });
  return { result, bars };
}

describe('report data', () => {
  it('builds equal-weight buy & hold from the first open', () => {
    const { bars } = sampleRun();
    const times = bars.AAPL.map((b) => b.timestamp);
    // 5,000 in each: 50 AAPL @100, 100 MSFT @50
    expect(buyAndHoldCurve(bars, 10_000, times)).toEqual([
      10_000, 10_500, 11_500, 10_500,
    ]);
  });

  it('computes drawdown from the running peak', () => {
    expect(drawdownCurve([100, 120, 90, 130])).toEqual([0, 0, -25, 0]);
  });

  it('shapes result, candles and fills for the charts', () => {
    const { result, bars } = sampleRun();
    const data = buildReportData(result, bars, { timeframe: '1Day' });

    expect(data.equity).toHaveLength(4);
    expect(data.equity[0]).toEqual({
      time: Date.UTC(2025, 0, 1) / 1000,
      value: 10_000,
    });
    expect(Object.keys(data.candles)).toEqual(['AAPL', 'MSFT']);
    expect(data.fills.map((f) => [f.side, f.price, f.pnl])).toEqual([
      ['buy', 100, null], // bar 1 open (= bar 0 close)
      ['sell', 120, 200], // bar 3 open
    ]);
    // Fill times line up with bar times, so markers land on candles.
    const candleTimes = data.candles.AAPL.map((c) => c.time);
    for (const f of data.fills) expect(candleTimes).toContain(f.time);
    expect(data.settings).toEqual({ timeframe: '1Day' });
  });
});

describe('buildHtmlReport', () => {
  it('produces a self-contained page with the charting library inlined', async () => {
    const { result, bars } = sampleRun();
    const html = await buildHtmlReport(result, bars);

    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<title>Backtest: test on AAPL, MSFT</title>');
    expect(html).toContain('TradingView Lightweight Charts');
    expect(html).not.toMatch(/<script[^>]+src=/); // nothing loaded from the network
    for (const fn of [
      'reportHelpers',
      'renderTiles',
      'renderCharts',
      'renderFills',
    ]) {
      expect(html).toContain(`function ${fn}(`);
    }
  });

  it('cannot be broken out of by text inside the data', async () => {
    const { result, bars } = sampleRun('</script><script>alert(1)</script>');
    const html = await buildHtmlReport(result, bars);

    expect(html).not.toContain('<script>alert(1)');
    const json =
      /<script type="application\/json" id="report-data">(.*?)<\/script>/s.exec(
        html,
      );
    expect(JSON.parse(json?.[1] ?? '').fills[0].reason).toBe(
      '</script><script>alert(1)</script>',
    );
  });
});
