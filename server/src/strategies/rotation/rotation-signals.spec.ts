import { basketVolPct, mixedReturn, steadiness } from './rotation-signals.js';

// Both end 20% up over 20 days: one a little every day, one in a single jump.
const steady = Array.from({ length: 21 }, (_, i) => 100 * 1.2 ** (i / 20));
const jumpy = Array.from({ length: 21 }, (_, i) =>
  i < 20 ? 100 - i * 0.1 : 120,
);

describe('rotation signals', () => {
  it('steadiness: a steady riser beats one that got there in a jump', () => {
    expect(steadiness(steady, 20, 20)).toBeCloseTo(1);
    expect(steadiness(jumpy, 20, 20)).toBeLessThan(0);
  });

  it('steadiness: a steady fall is steady too (only winners are picked)', () => {
    const falling = [...steady].reverse();
    expect(steadiness(falling, 20, 20)).toBeCloseTo(1);
  });

  it('mixedReturn averages a quarter, half and all of the window', () => {
    const c = [100, 100, 100, 100, 110, 120, 130, 140, 200];
    // lookback 8: returns over 2 (200/130), 4 (200/110) and 8 (200/100) bars.
    expect(mixedReturn(c, 8, 8)).toBeCloseTo(
      (200 / 130 - 1 + 200 / 110 - 1 + 1) / 3,
    );
  });

  it('basketVolPct: two stocks moving opposite cancel out, together they add up', () => {
    const zigzag = (up: boolean) =>
      Array.from(
        { length: 31 },
        (_, i) => 100 * (i % 2 === (up ? 0 : 1) ? 1.02 : 1),
      );
    const closes = new Map([
      ['A', zigzag(true)],
      ['B', zigzag(false)],
    ]);
    const opposite = basketVolPct(['A', 'B'], [1, 1], closes, 30) ?? NaN;
    const alone = basketVolPct(['A'], [1], closes, 30) ?? NaN;
    expect(alone).toBeGreaterThan(20);
    expect(opposite).toBeLessThan(alone / 5);
  });

  it('basketVolPct: null without enough history or picks', () => {
    expect(basketVolPct([], [], new Map(), 30)).toBeNull();
    expect(basketVolPct(['A'], [1], new Map([['A', [1, 2]]]), 30)).toBeNull();
  });
});
