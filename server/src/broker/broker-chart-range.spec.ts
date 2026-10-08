import type { BacktestService } from '../backtest/backtest.service.js';
import { isChartRange, rangeBars, sma } from './broker-chart-range.js';

const bar = (iso: string) => ({
  symbol: 'AAA',
  timestamp: new Date(iso),
  open: 1,
  high: 1,
  low: 1,
  close: 1,
  volume: 1,
});

describe('chart ranges', () => {
  it('1D keeps only the last New York session of the intraday bars', async () => {
    const fetchBars = vi.fn(async () => ({
      AAA: [
        bar('2026-10-06T19:55:00Z'), // Tue 15:55 New York
        bar('2026-10-07T13:30:00Z'), // Wed 09:30
        bar('2026-10-07T19:55:00Z'), // Wed 15:55
      ],
    }));
    const out = await rangeBars(
      { fetchBars } as unknown as BacktestService,
      'AAA',
      '1d',
      null,
    );
    expect(out.map((b) => b.timestamp.toISOString())).toEqual([
      '2026-10-07T13:30:00.000Z',
      '2026-10-07T19:55:00.000Z',
    ]);
    expect(fetchBars).toHaveBeenCalledWith(
      ['AAA'],
      expect.objectContaining({ timeframe: '5Min' }),
    );
  });

  it('"buy" starts 3 months before the buy, daily', async () => {
    const fetchBars = vi.fn(async () => ({ AAA: [] }));
    await rangeBars(
      { fetchBars } as unknown as BacktestService,
      'AAA',
      'buy',
      new Date('2026-10-02'),
    );
    expect(fetchBars).toHaveBeenCalledWith(
      ['AAA'],
      expect.objectContaining({
        timeframe: '1Day',
        from: new Date('2026-07-04'),
      }),
    );
  });

  it('knows its ranges', () => {
    expect(isChartRange('3m')).toBe(true);
    expect(isChartRange('2w')).toBe(false);
  });
});

describe('sma', () => {
  it('averages the last n closes, null until there are n', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
});
