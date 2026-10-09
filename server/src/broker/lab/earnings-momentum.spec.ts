import type { StrategyBar } from '../../strategies/strategy.types.js';
import {
  announcementReturn,
  dailyCloses,
  quarters,
  sue,
  type Quarter,
} from './earnings-momentum.js';

describe('quarters', () => {
  it('works out the fourth quarter from the year, first filings only', () => {
    const q = quarters([
      { start: '2023-01-01', end: '2023-03-31', val: 10, filed: '2023-05-01' },
      { start: '2023-01-01', end: '2023-03-31', val: 99, filed: '2024-05-01' }, // a later copy
      { start: '2023-04-01', end: '2023-06-30', val: 20, filed: '2023-08-01' },
      { start: '2023-07-01', end: '2023-09-30', val: 30, filed: '2023-11-01' },
      { start: '2023-01-01', end: '2023-12-31', val: 100, filed: '2024-02-20' },
      { start: '2023-01-01', end: '2023-06-30', val: 30, filed: '2023-08-01' }, // 6 months: ignored
    ]);
    expect(q.map((x) => x.val)).toEqual([10, 20, 30, 40]);
    expect(q[3]).toEqual({ end: '2023-12-31', val: 40, filed: '2024-02-20' });
  });
});

describe('sue', () => {
  /** Quarters from 2020 on, each filed a month after it ends. */
  const series = (vals: number[]): Quarter[] =>
    vals.map((val, i) => {
      const end = new Date(Date.UTC(2020, 3 * i + 3, 0));
      const filed = new Date(end.getTime() + 30 * 86_400_000);
      return {
        end: end.toISOString().slice(0, 10),
        val,
        filed: filed.toISOString().slice(0, 10),
      };
    });
  // Growth of ~1 a year with some noise.
  const vals = [10, 11, 12, 13, 11, 12.2, 12.8, 14.1, 12, 13, 14, 15, 12.2];

  it('is positive when earnings beat the year before, and only uses what was filed', () => {
    const s = series(vals);
    expect(sue(s, s[11].filed)).toBeGreaterThan(2);
    expect(sue(s, s[11].end)).toBe(sue(s, s[10].filed));
    // The last quarter grew only 0.2 from a year before: a much smaller score.
    expect(sue(s, s[12].filed)).toBeLessThan(1);
    expect(sue(series(vals.map((v) => -v)), s[11].filed)).toBeLessThan(-2);
  });

  it('needs enough history', () => {
    const s = series(vals.slice(0, 6));
    expect(sue(s, s[5].filed)).toBeNull();
  });
});

describe('announcementReturn', () => {
  const bars = (closes: number[]): StrategyBar[] =>
    closes.map((close, i) => ({
      symbol: 'X',
      timestamp: new Date(Date.UTC(2024, 0, 2 + i)),
      open: close,
      high: close,
      low: close,
      close,
      volume: 0,
    }));
  const stock = dailyCloses(bars([100, 100, 110, 112, 112]));
  const spy = dailyCloses(bars([100, 100, 101, 102, 102]));

  it('is the stock’s move around the release minus SPY’s', () => {
    // Released on Jan 4 (index 2): close of Jan 3 → close of Jan 5.
    const r = announcementReturn(stock, spy, ['2024-01-04'], '2024-01-06');
    expect(r).toBeCloseTo(0.12 - 0.02);
  });

  it('waits for the day after the release', () => {
    expect(
      announcementReturn(stock, spy, ['2024-01-04'], '2024-01-04'),
    ).toBeNull();
  });
});
