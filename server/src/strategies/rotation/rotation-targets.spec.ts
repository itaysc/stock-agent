import { earningsDays } from './rotation-events.js';
import { sectors } from './rotation-sectors.js';
import { recentOk, rotationTargets } from './rotation-targets.js';

const P = {
  lookback: 40,
  skipRecent: 21,
  topN: 2,
  absMomentum: 1,
  safeLast: 1,
  volWeight: 0,
  allocation: 1,
  rankBy: 0,
  recentDrop: 15,
  recentDropHeld: 0,
};
// 63 closes: a strong rise, then the last month as given.
const series = (lastMonth: number) =>
  Array.from({ length: 63 }, (_, i) =>
    i < 41 ? 100 + i * 2 : 180 * (1 + (lastMonth * (i - 41)) / 21),
  );
const closes = new Map([
  ['AAA', series(-0.25)], // a great year, then -25% in a month
  ['BBB', series(0.02)],
  ['BIL', Array.from({ length: 63 }, () => 100)],
]);
const state = (p: Record<string, number>, held?: (s: string) => boolean) => ({
  p,
  symbols: ['AAA', 'BBB', 'BIL'],
  closes,
  vols: new Map(),
  marketDown: false,
  aboveTrend: () => true,
  held,
});

describe('rotation recentDrop', () => {
  it('says whether a stock fell more than recentDrop % in the last month', () => {
    expect(recentOk(P, closes, 'AAA')).toBe(false);
    expect(recentOk(P, closes, 'BBB')).toBe(true);
    expect(recentOk({ ...P, recentDrop: 0 }, closes, 'AAA')).toBe(true);
  });

  it('does not buy a stock that just fell, its slot goes to the safe asset', () => {
    const t = rotationTargets(state(P));
    expect([...t.keys()].sort()).toEqual(['BBB', 'BIL']);
  });

  it('keeps a held one unless recentDropHeld', () => {
    const held = (s: string) => s === 'AAA';
    expect(rotationTargets(state(P, held)).has('AAA')).toBe(true);
    expect(
      rotationTargets(state({ ...P, recentDropHeld: 1 }, held)).has('AAA'),
    ).toBe(false);
  });

  it('changes nothing when off', () => {
    const t = rotationTargets(state({ ...P, recentDrop: 0 }));
    expect([...t.keys()].sort()).toEqual(['AAA', 'BBB']);
  });
});

const rising = (step: number) =>
  Array.from({ length: 63 }, (_, i) => 100 + i * step);

describe('rotation keepRank', () => {
  // AAA ranks 1, BBB 2, CCC 3; hold the top 1.
  const ranks = new Map([
    ['AAA', rising(3)],
    ['BBB', rising(2)],
    ['CCC', rising(1)],
    ['BIL', Array.from({ length: 63 }, () => 100)],
  ]);
  const at = (p: Record<string, number>, held: (s: string) => boolean) =>
    rotationTargets({
      p: { ...P, recentDrop: 0, topN: 1, ...p },
      symbols: ['AAA', 'BBB', 'CCC', 'BIL'],
      closes: ranks,
      vols: new Map(),
      marketDown: false,
      aboveTrend: () => true,
      held,
    });

  it('keeps a held stock while it ranks within keepRank', () => {
    const t = at({ keepRank: 2 }, (s) => s === 'BBB');
    expect([...t.keys()]).toEqual(['BBB']);
  });

  it('sells it once it ranks below keepRank, or with keepRank off', () => {
    expect([...at({ keepRank: 2 }, (s) => s === 'CCC').keys()]).toEqual([
      'AAA',
    ]);
    expect([...at({ keepRank: 0 }, (s) => s === 'BBB').keys()]).toEqual([
      'AAA',
    ]);
  });
});

describe('rotation sectorTop (industry momentum)', () => {
  it('only buys from the sectors that rose most on average', () => {
    sectors.add({ T1: 'Tech', T2: 'Tech', E1: 'Energy', E2: 'Energy' });
    const closes = new Map([
      ['T1', rising(1)], // Tech: one weak, one fair
      ['T2', rising(2)],
      ['E1', rising(3)], // Energy: the strongest on average
      ['E2', rising(2.5)],
      ['BIL', Array.from({ length: 63 }, () => 100)],
    ]);
    const t = rotationTargets({
      p: { ...P, recentDrop: 0, topN: 2, sectorTop: 1 },
      symbols: ['T1', 'T2', 'E1', 'E2', 'BIL'],
      closes,
      vols: new Map(),
      marketDown: false,
      aboveTrend: () => true,
    });
    expect([...t.keys()].sort()).toEqual(['E1', 'E2']);
  });
});

describe('rotation earningsWait', () => {
  afterEach(() => earningsDays.set(null));
  const closes = new Map([
    ['AAA', rising(3)],
    ['BBB', rising(2)],
    ['BIL', Array.from({ length: 63 }, () => 100)],
  ]);
  const at = (held?: (s: string) => boolean) =>
    rotationTargets({
      p: { ...P, recentDrop: 0, topN: 1, earningsWait: 4 },
      symbols: ['AAA', 'BBB', 'BIL'],
      closes,
      vols: new Map(),
      marketDown: false,
      aboveTrend: () => true,
      held,
      now: new Date('2026-10-19T21:00:00Z'),
    });

  it('skips starting a stock that reports within the next days, keeps a held one', () => {
    earningsDays.set({ AAA: ['2026-10-21'] });
    expect([...at().keys()]).toEqual(['BBB']);
    expect([...at((s) => s === 'AAA').keys()]).toEqual(['AAA']);
  });

  it('buys it when the report is today (already out) or further away', () => {
    earningsDays.set({ AAA: ['2026-10-19', '2026-11-30'] });
    expect([...at().keys()]).toEqual(['AAA']);
  });
});
