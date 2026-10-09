import { blendScores, fundamentals } from './rotation-fundamentals.js';

describe('blendScores', () => {
  afterEach(() => fundamentals.set(null));
  // CHEAP: cheap and profitable, weak momentum; HOT: expensive, strong momentum; NONE: no reports.
  const data = {
    CHEAP: { ep: 0.1, bm: 0.8, gpa: 0.4, roa: 0.1 },
    HOT: { ep: 0.01, bm: 0.05, gpa: 0.1, roa: 0.01 },
    MID: { ep: 0.05, bm: 0.3, gpa: 0.2, roa: 0.05 },
  } as Record<string, { ep: number; bm: number; gpa: number; roa: number }>;
  const mom = { CHEAP: 0.05, HOT: 0.9, MID: 0.3, NONE: 0.5 } as Record<
    string,
    number
  >;
  const at = new Date('2020-01-01');
  const score = (blend: number) => {
    fundamentals.set((s) => data[s] ?? null);
    return blendScores(Object.keys(mom), at, (s) => mom[s], blend);
  };

  it('value + quality alone prefers the cheap, profitable one', () => {
    const s = score(5);
    expect(s.get('CHEAP')).toBeGreaterThan(s.get('HOT') ?? 0);
  });

  it('momentum + value counts both equally', () => {
    const s = score(1);
    // CHEAP: top value, bottom momentum; HOT: the reverse.
    expect(s.get('CHEAP')).toBeCloseTo(s.get('HOT') ?? 0);
  });

  it('counts a stock without reports as average, not worst', () => {
    expect(score(5).get('NONE')).toBe(0.5);
  });

  it('the quality filter pushes the low-quality half below every better one', () => {
    const s = score(4);
    expect(s.get('HOT')).toBeLessThan(s.get('CHEAP') ?? 0);
  });

  it('earnings momentum: the weaker-earnings half ranks below the better one', () => {
    fundamentals.set(
      (s) =>
        ({
          HOT: {
            ep: 0,
            bm: 0,
            gpa: 0,
            roa: 0,
            sue: -2,
            sueRev: -1,
            ear: -0.05,
          },
          MID: { ep: 0, bm: 0, gpa: 0, roa: 0, sue: 3, sueRev: 2, ear: 0.06 },
        })[s] ?? null,
    );
    const s = blendScores(['HOT', 'MID'], at, (x) => mom[x], 9);
    expect(s.get('MID')).toBeGreaterThan(s.get('HOT') ?? 0);
    expect(blendScores(['HOT', 'MID'], at, (x) => mom[x], 6).get('MID')).toBe(
      0.5,
    );
  });
});
