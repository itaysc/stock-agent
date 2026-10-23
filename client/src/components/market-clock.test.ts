import { timeLeft } from './MarketClock';

describe('timeLeft', () => {
  it('reads like a countdown', () => {
    expect(timeLeft((2 * 3600 + 14 * 60 + 5) * 1000)).toBe('2h 14m');
    expect(timeLeft((15 * 60 + 3) * 1000)).toBe('15m 03s');
    expect(timeLeft(27 * 3600 * 1000)).toBe('1d 3h');
    expect(timeLeft(-5000)).toBe('0m 00s');
  });
});
