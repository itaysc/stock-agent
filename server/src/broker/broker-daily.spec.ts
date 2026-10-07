import type { Deployment } from '../paper/deployment.types.js';
import { dailyResults } from './broker-daily.js';

describe('dailyResults', () => {
  it('gives each trading day its change from the day before (the first from the amount put in)', () => {
    const d = {
      capital: 1000,
      snapshots: [
        { timestamp: new Date('2026-10-01T04:00:00Z'), equity: 990 },
        { timestamp: new Date('2026-10-02T04:00:00Z'), equity: 1009.8 },
      ],
    } as unknown as Deployment;
    const [a, b] = dailyResults(d);
    expect(a).toMatchObject({ date: '2026-10-01', pnl: -10, pct: -1 });
    expect(b.date).toBe('2026-10-02');
    expect(b.pnl).toBeCloseTo(19.8);
    expect(b.pct).toBeCloseTo(2);
  });
});
