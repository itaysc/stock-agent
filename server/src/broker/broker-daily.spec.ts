import type { Deployment } from '../paper/deployment.types.js';
import { dailyResults } from './broker-daily.js';

describe('dailyResults', () => {
  it('starts on the decision day at the amount put in, then each day vs the day before', () => {
    const d = {
      capital: 1000,
      snapshots: [
        // The decision day: its stored worth is the next-open buys at that day's closes (not a real result).
        { timestamp: new Date('2026-10-01T04:00:00Z'), equity: 990 },
        { timestamp: new Date('2026-10-02T04:00:00Z'), equity: 1020 },
        { timestamp: new Date('2026-10-05T04:00:00Z'), equity: 1009.8 },
      ],
    } as unknown as Deployment;
    const [a, b, c] = dailyResults(d);
    expect(a).toMatchObject({
      date: '2026-10-01',
      equity: 1000,
      pnl: 0,
      pct: 0,
    });
    expect(b).toMatchObject({ date: '2026-10-02', pnl: 20, pct: 2 });
    expect(c.pnl).toBeCloseTo(-10.2);
    expect(c.pct).toBeCloseTo(-1);
  });
});
