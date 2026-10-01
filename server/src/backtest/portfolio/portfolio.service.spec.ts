import { makeBars } from '../../../test/support/bars.js';
import type { BacktestService } from '../backtest.service.js';
import { PortfolioService } from './portfolio.service.js';
import type { PortfolioRequest } from './portfolio.types.js';
import { parseSleeve } from './sleeve-spec.js';

const bars = {
  AAPL: makeBars(
    'AAPL',
    Array.from({ length: 300 }, (_, i) => 100 + 10 * Math.sin(i / 9)),
  ),
};
const fetchBars = vi.fn(async () => bars);
const service = new PortfolioService({
  fetchBars,
  fetchMarket: async () => ({}),
} as unknown as BacktestService);
const request = (sleeves: PortfolioRequest['sleeves']): PortfolioRequest => ({
  sleeves,
  risk: { maxDrawdownPct: 0, cooldownDays: 0 },
  timeframe: '1Day',
  from: new Date('2025-01-01'),
  to: new Date('2025-11-01'),
  initialCash: 10_000,
  slippageBps: 0,
  feePerShare: 0,
  cashYieldPct: 0,
});

describe('portfolio sleeves', () => {
  it('parses "WEIGHT STRATEGY SYMBOLS params"', () => {
    expect(parseSleeve('40% rules aapl,MSFT breakout=20 atrStop=3')).toEqual({
      weightPct: 40,
      strategy: 'rules',
      symbols: ['aapl', 'MSFT'],
      params: { breakout: '20', atrStop: '3' },
    });
    expect(() => parseSleeve('rules AAPL')).toThrow(/Invalid sleeve/);
    expect(() => parseSleeve('40 rules AAPL breakout')).toThrow(
      /Invalid param "breakout"/,
    );
  });

  it('runs valid sleeves and rejects bad ones before downloading anything', async () => {
    const ok = await service.run(
      request([parseSleeve('60 sma-crossover aapl fast=5 slow=20')]),
    );
    expect(ok.sleeves[0].label).toBe(
      '60% sma-crossover on AAPL (fast=5 slow=20)',
    );
    expect(ok.reserve.allocated).toBe(4_000);

    fetchBars.mockClear();
    const fail = (sleeves: string[]) =>
      service.run(request(sleeves.map(parseSleeve)));
    await expect(fail(['70 rules AAPL', '40 rules AAPL'])).rejects.toThrow(
      /at most 100% \(got 110%\)/,
    );
    await expect(fail(['0 rules AAPL'])).rejects.toThrow(/above 0%/);
    await expect(
      fail(['50 sma-crossover AAPL fast=50 slow=20']),
    ).rejects.toThrow(
      /Sleeve 1 \(sma-crossover\): fast must be less than slow/,
    );
    await expect(fail(['50 nope AAPL'])).rejects.toThrow(
      /Unknown strategy "nope"/,
    );
    expect(fetchBars).not.toHaveBeenCalled();
  });
});
