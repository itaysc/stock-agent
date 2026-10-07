import { tradingDay } from './when';

describe('tradingDay', () => {
  it('keeps a plain date as is, and dates a timestamp in New York', () => {
    expect(tradingDay('2026-10-01')).toMatch(/Oct 1\b/);
    // 04:00 UTC = midnight in New York: still Oct 5 there.
    expect(tradingDay('2026-10-05T04:00:00.000Z')).toMatch(/Oct 5\b/);
    // 02:00 UTC on Oct 6 is still Oct 5 in New York.
    expect(tradingDay('2026-10-06T02:00:00.000Z')).toMatch(/Oct 5\b/);
  });
});
