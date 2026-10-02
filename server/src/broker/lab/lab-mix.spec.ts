import { mixCurves } from './lab-mix.js';

const curve = (points: Array<[string, number]>) =>
  points.map(([day, equity]) => ({ timestamp: new Date(day), equity }));

describe('mixCurves', () => {
  it('re-balances at the start of each year and measures the mix drop', () => {
    const a = curve([
      ['2020-01-02', 100],
      ['2020-12-31', 200],
      ['2021-01-04', 200],
      ['2021-12-31', 100],
    ]);
    const b = curve([
      ['2020-01-02', 100],
      ['2020-12-31', 100],
      ['2021-01-04', 100],
      ['2021-12-31', 100],
    ]);
    // 2020: 0.5×2 + 0.5×1 = 1.5; re-balanced to 0.75 / 0.75; 2021: 0.75×0.5 + 0.75 = 1.125
    const m = mixCurves([
      { curve: a, weight: 0.5 },
      { curve: b, weight: 0.5 },
    ]);
    expect(m.returnPct).toBeCloseTo(12.5);
    expect(m.maxDrawdownPct).toBeCloseTo(25);
  });
});
