import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chart = vi.fn(async (symbol: string) => ({
  quotes: [
    {
      date: new Date('2020-01-02T14:30:00Z'),
      open: 100,
      high: 110,
      low: 90,
      close: 100,
      adjclose: 50,
      volume: 7,
    },
    {
      date: new Date('2020-01-03T14:30:00Z'),
      open: null,
      high: null,
      low: null,
      close: null,
      adjclose: null,
      volume: null,
    },
    {
      date: new Date('2020-01-06T14:30:00Z'),
      open: 102,
      high: 104,
      low: 101,
      close: 102,
      adjclose: 51,
      volume: 9,
    },
  ],
  symbol,
}));
vi.mock('yahoo-finance2', () => ({
  default: class {
    chart = chart;
  },
}));
const { yahooDaily } = await import('./yahoo-history.js');

describe('Yahoo history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yahoo-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('adjusts for dividends and splits, skips empty days, maps BRK.B, and caches', async () => {
    const from = new Date('2020-01-01');
    const to = new Date('2020-01-07');
    const bars = await yahooDaily(['BRK.B'], from, to, dir);
    expect(chart).toHaveBeenCalledWith(
      'BRK-B',
      expect.objectContaining({ interval: '1d' }),
      { validateResult: false },
    );
    expect(bars['BRK.B']).toEqual([
      {
        symbol: 'BRK.B',
        timestamp: new Date('2020-01-02'),
        open: 50,
        high: 55,
        low: 45,
        close: 50,
        volume: 7,
      },
      {
        symbol: 'BRK.B',
        timestamp: new Date('2020-01-06'),
        open: 51,
        high: 52,
        low: 50.5,
        close: 51,
        volume: 9,
      },
    ]);
    await yahooDaily(['BRK.B'], from, to, dir);
    expect(chart).toHaveBeenCalledTimes(1); // from the disk cache
  });
});
