import { painStats } from './pain-stats.js';

/** One point a month from 2020, with these values. */
const monthly = (vals: number[]) =>
  vals.map((equity, i) => ({
    timestamp: new Date(Date.UTC(2020, i, 1)),
    equity,
  }));

describe('painStats', () => {
  it('measures the wait to get back to a peak and the ulcer index', () => {
    // Peak 100 in Jan, down to 50, back above 100 only in May.
    const p = painStats(monthly([100, 50, 75, 90, 110]));
    expect(p.longestUnderwaterMonths).toBeCloseTo(3, 0);
    // Below the peak: 0, 50, 25, 10, 0 → √((2500 + 625 + 100) / 5).
    expect(p.ulcerIndex).toBeCloseTo(Math.sqrt(3225 / 5));
    expect(p.calmar).toBeGreaterThan(0);
  });

  it('is calm for a curve that only rises', () => {
    const p = painStats(monthly([100, 101, 102, 103]));
    expect(p).toMatchObject({ ulcerIndex: 0, longestUnderwaterMonths: 0 });
  });

  it('compares every 3-year stretch with SPY', () => {
    // Flat for 4 years while SPY grows 1% a month.
    const months = Array.from({ length: 48 }, (_, i) => i);
    const p = painStats(
      monthly(months.map(() => 100)),
      monthly(months.map((i) => 100 * 1.01 ** i)),
    );
    expect(p.vsSpy3y?.trailedPct).toBe(100);
    expect(p.vsSpy3y?.worstGapPct).toBeCloseTo(-(1.01 ** 12 - 1) * 100);
  });
});
