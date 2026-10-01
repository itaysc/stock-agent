import { countWindows, durationLabel, parseDuration } from './walkForward';

describe('walk-forward windows', () => {
  it('parses durations like the server', () => {
    expect(parseDuration('12m')).toEqual({ amount: 12, unit: 'm' });
    expect(parseDuration(' 2Y ')).toEqual({ amount: 2, unit: 'y' });
    expect(parseDuration('0m')).toBeNull();
    expect(parseDuration('12 months')).toBeNull();
    expect(durationLabel({ amount: 1, unit: 'm' })).toBe('1 month');
  });

  it('counts test windows, including a shorter last one', () => {
    const m = (amount: number) => ({ amount, unit: 'm' as const });
    expect(countWindows('2023-01-01', '2025-01-01', m(6), m(3))).toBe(6);
    expect(countWindows('2023-01-01', '2025-02-01', m(6), m(3))).toBe(7);
    expect(countWindows('2023-01-01', '2023-06-01', m(6), m(3))).toBe(0);
  });
});
