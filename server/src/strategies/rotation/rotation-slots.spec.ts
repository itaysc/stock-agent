import { makeBars } from '../../../test/support/bars.js';
import { runBacktest } from '../../backtest/backtest-engine.js';
import { createStrategy } from '../strategy-registry.js';
import { MomentumRotationStrategy } from './momentum-rotation.strategy.js';
import { leaveSlotsEmpty } from './rotation-slots.js';

describe('leaveSlotsEmpty', () => {
  const w = new Map([
    ['A', { weight: 0.3, why: 'rank 1' }],
    ['B', { weight: 0.3, why: 'rank 2' }],
    ['C', { weight: 0.4, why: 'rank 3' }],
  ]);
  it("drops the lowest-ranked pick it doesn't hold; its share waits in the safe asset", () => {
    const out = leaveSlotsEmpty(w, ['A', 'B', 'C'], (s) => s !== 'C', 1, 'BIL');
    expect([...out.keys()]).toEqual(['A', 'B', 'BIL']);
    expect(out.get('BIL')?.weight).toBeCloseTo(0.4);
    expect(out.get('BIL')?.why).toMatch(/slot you left empty/);
  });
  it('keeps everything it holds, and changes nothing without empty slots', () => {
    expect(leaveSlotsEmpty(w, ['A', 'B', 'C'], () => true, 1, 'BIL')).toEqual(
      w,
    );
    expect(leaveSlotsEmpty(w, ['A', 'B', 'C'], () => false, 0, 'BIL')).toBe(w);
  });
});

describe('steering the rotation (what you did by hand)', () => {
  // A leads, B second, C third: with topN 2 it holds A and B.
  const up = (step: number) =>
    Array.from({ length: 12 }, (_, i) => 100 * (1 + step) ** i);
  const bars = { A: up(0.05), B: up(0.03), C: up(0.01), BIL: up(0) };
  const params = {
    lookback: '3',
    rebalanceDays: '2',
    topN: '2',
    band: '0',
    volLookback: '5',
    volWeight: '0',
    safeLast: '1',
  };
  const run = (steer: { skip: (s: string) => boolean; emptySlots: number }) => {
    const s = createStrategy(
      'momentum-rotation',
      Object.keys(bars),
      params,
    ) as MomentumRotationStrategy;
    s.steer = steer;
    const r = runBacktest(
      s,
      Object.fromEntries(
        Object.entries(bars).map(([k, c]) => [k, makeBars(k, c)]),
      ),
      { initialCash: 10_000, slippageBps: 0, feePerShare: 0 },
    );
    return r.openPositions.map((p) => p.symbol).sort();
  };

  it('skips a stock you sold: the next in line takes its place', () => {
    expect(run({ skip: () => false, emptySlots: 0 })).toEqual(['A', 'B']);
    expect(run({ skip: (s) => s === 'A', emptySlots: 0 })).toEqual(['B', 'C']);
  });

  it('leaves a slot you emptied in the safe asset instead of buying the next in line', () => {
    expect(run({ skip: (s) => s === 'A', emptySlots: 1 })).toEqual([
      'B',
      'BIL',
    ]);
  });
});
