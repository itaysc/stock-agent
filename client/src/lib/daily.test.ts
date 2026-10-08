import { combineDays } from './daily';

describe('combineDays', () => {
  it('adds the investments up day by day', () => {
    const out = combineDays([
      [
        { date: '2026-10-01', equity: 1010, pnl: 10, pct: 1 },
        { date: '2026-10-02', equity: 1000, pnl: -10, pct: -0.99 },
      ],
      [{ date: '2026-10-02', equity: 2040, pnl: 40, pct: 2 }],
    ]);
    expect(out.map((d) => [d.date, d.pnl])).toEqual([
      ['2026-10-01', 10],
      ['2026-10-02', 30],
    ]);
    // Oct 2: +30 on (1010 + 2000) the day before
    expect(out[1].pct).toBeCloseTo((30 / 3010) * 100);
  });
});

describe('combineDays with today so far', () => {
  it('keeps the live mark when any investment’s day is live', () => {
    const out = combineDays([
      [{ date: '2026-10-07', equity: 1010, pnl: 10, pct: 1, live: true }],
      [{ date: '2026-10-07', equity: 500, pnl: 0, pct: 0 }],
    ]);
    expect(out[0].live).toBe(true);
  });
});
