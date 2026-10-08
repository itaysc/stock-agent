import {
  basketVolPct,
  mixedReturn,
  nearHigh,
  residualScore,
  steadiness,
  stretch,
  volumeSurge,
} from './rotation-signals.js';

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

describe('residual momentum and the 52-week high', () => {
  const market = Array.from(
    { length: 61 },
    (_, i) => 100 * (1 + (i % 3 ? 0.01 : -0.015)) ** i,
  );
  // Follows the market with this beta, plus `own(k)` of its own each day.
  const follow = (beta: number, own: (k: number) => number) =>
    market.map((_, i) =>
      market
        .slice(1, i + 1)
        .reduce(
          (n, m, k) => n * (1 + beta * (m / market[k] - 1) + own(k)),
          100,
        ),
    );
  const noise = (k: number) => (k % 2 ? 0.002 : -0.002);

  it('scores a stock by what it did beyond the market, not by riding it', () => {
    const riding = residualScore(follow(2, noise), market, 60, 40);
    const own = residualScore(
      follow(1, (k) => noise(k) + 0.003),
      market,
      60,
      40,
    );
    expect(Math.abs(riding)).toBeLessThan(0.2);
    expect(own).toBeGreaterThan(1);
  });

  it('is NaN without enough market history', () => {
    expect(
      residualScore(follow(1, noise), market.slice(-10), 60, 40),
    ).toBeNaN();
  });

  it('nearHigh is 1 at the high and below it after a fall', () => {
    expect(nearHigh([90, 95, 100], 3)).toBe(1);
    expect(nearHigh([90, 120, 96], 3)).toBeCloseTo(0.8);
  });
});

describe('volumeSurge', () => {
  it('is recent volume against the past year', () => {
    const v = Array.from({ length: 252 }, (_, i) => (i >= 189 ? 300 : 100));
    // last 63 days at 300; the year's average (189×100 + 63×300) / 252 = 150
    expect(volumeSurge(v)).toBeCloseTo(2);
    expect(volumeSurge(v.slice(-100))).toBeNull();
  });
});

describe('stretch', () => {
  it('is how far the close is above its 50-day average', () => {
    const c = [...Array.from({ length: 49 }, () => 100), 151];
    expect(stretch(c)).toBeCloseTo(151 / 101 - 1);
    expect(stretch(c.slice(1))).toBeNull();
  });
});
