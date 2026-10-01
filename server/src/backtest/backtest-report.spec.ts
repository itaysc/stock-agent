import { makeBars } from '../../test/support/bars.js';
import type { Strategy } from '../strategies/strategy.types.js';
import { runBacktest } from './backtest-engine.js';
import { DISCLAIMER, formatReport } from './backtest-report.js';

describe('formatReport', () => {
  it('summarizes results, reduced and rejected buys, open positions and fills', () => {
    let bar = 0;
    const strategy: Strategy = {
      name: 'test',
      symbols: ['AAPL'],
      onBar: (_bar, ctx) => {
        if (bar === 0) ctx.buy('AAPL', 100); // fills at 100: 10,000 of 10,500
        if (bar === 1) ctx.buy('AAPL', 10); // opens at 110: only 4 fit in 500
        if (bar === 2) ctx.buy('AAPL', 1); // 60 left: not even one share
        bar++;
      },
    };
    const result = runBacktest(
      strategy,
      { AAPL: makeBars('AAPL', [100, 110, 120, 130]) },
      { initialCash: 10_500, slippageBps: 0, feePerShare: 0 },
    );

    const report = formatReport(result);

    expect(report).toContain('Strategy     test on AAPL');
    expect(report).toContain('Period       2025-01-01 → 2025-01-04 (4 bars)');
    expect(report).toContain('$10,500.00 → $13,580.00'); // 60 + 104 × 130
    expect(report).toContain('Rejected     1 orders (insufficient cash: 1)');
    expect(report).toContain('Reduced      1 buys to fit the cash');
    expect(report).toContain('Open         104 AAPL @ 100.38');
    expect(report).toMatch(/2025-01-03 buy\s+4 AAPL @ 110\.00/);
    expect(report).toContain(DISCLAIMER);
  });
});
