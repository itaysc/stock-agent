import { averageTargets, Tranches, type Targets } from './rotation-tranches.js';

const t = (o: Record<string, number>): Targets =>
  new Map(Object.entries(o).map(([s, weight]) => [s, { weight, why: s }]));
const weights = (m: Targets) =>
  Object.fromEntries(
    [...m].map(([s, x]) => [s, Math.round(x.weight * 1000) / 1000]),
  );

describe('rotation tranches', () => {
  it('averages target maps (missing counts 0)', () => {
    expect(
      weights(averageTargets([t({ A: 0.5, B: 0.5 }), t({ A: 0.5, C: 0.5 })])),
    ).toEqual({
      A: 0.5,
      B: 0.25,
      C: 0.25,
    });
  });

  it('moves one tranche a day: a new pick grows by a fifth each day', () => {
    const tr = new Tranches(5);
    tr.push(t({ A: 1 }));
    for (let i = 0; i < 4; i++) tr.push(t({ A: 1 }));
    expect(weights(tr.push(t({ B: 1 })))).toEqual({ A: 0.8, B: 0.2 });
    expect(weights(tr.push(t({ B: 1 })))).toEqual({ A: 0.6, B: 0.4 });
  });

  it('starts with what it has, and clear() starts over', () => {
    const tr = new Tranches(5);
    expect(weights(tr.push(t({ A: 1 })))).toEqual({ A: 1 });
    tr.clear();
    expect(weights(tr.push(t({ B: 1 })))).toEqual({ B: 1 });
  });
});
