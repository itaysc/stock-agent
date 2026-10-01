import { makeBars } from '../../../test/support/bars.js';
import { runBacktest } from '../../backtest/backtest-engine.js';
import type { StrategyBar } from '../strategy.types.js';
import { createStrategy } from '../strategy-registry.js';

const options = { initialCash: 10_000, slippageBps: 0, feePerShare: 0 };
const series = (start: number, steps: number[]) =>
  steps.reduce<number[]>(
    (a, d) => [...a, (a.at(-1) ?? start) * (1 + d)],
    [start],
  );
const run = (
  symbols: Record<string, number[]>,
  params: Record<string, string>,
) =>
  runBacktest(
    createStrategy('momentum-rotation', Object.keys(symbols), params),
    Object.fromEntries(
      Object.entries(symbols).map(([s, c]) => [s, makeBars(s, c)]),
    ),
    options,
  );
const held = (r: ReturnType<typeof run>) =>
  r.openPositions.map((p) => p.symbol).sort();
const base = {
  lookback: '3',
  rebalanceDays: '2',
  topN: '1',
  band: '0',
  volLookback: '5',
};

describe('momentum rotation', () => {
  it('holds the best-ranked symbol and rotates when the leader changes (sells pay for buys)', () => {
    // A leads first, then B takes over.
    const a = [10, 11, 12, 13, 14, 14, 13, 12, 11, 10, 9, 8];
    const b = [10, 10, 10, 10, 10, 11, 12, 13, 14, 15, 16, 17];
    const r = run({ A: a, B: b }, base);
    const firstBuy = r.fills[0];
    expect(firstBuy).toMatchObject({
      symbol: 'A',
      side: 'buy',
      reason: expect.stringMatching(/^rank 1: \+\d+\.\d% over 3 bars$/),
    });
    const sellA = r.fills.find((f) => f.symbol === 'A' && f.side === 'sell');
    const buyB = r.fills.find((f) => f.symbol === 'B' && f.side === 'buy');
    expect(sellA?.timestamp).toEqual(buyB?.timestamp); // same open: the sale funds the buy
    expect(buyB?.requestedQty).toBeUndefined(); // not reduced for lack of cash
    expect(held(r)).toEqual(['B']);
  });

  it('with absolute momentum, a falling market goes to the safe asset (or cash)', () => {
    const falling = series(100, Array(11).fill(-0.02));
    const bonds = series(100, Array(11).fill(0.001));
    const safe = run(
      { A: falling, B: falling.map((x) => x * 2), TLT: bonds },
      { ...base, safeLast: '1' },
    );
    expect(held(safe)).toEqual(['TLT']);
    expect(safe.fills[0].reason).toBe('safe asset for 1 empty slot');
    const cash = run({ A: falling, B: falling.map((x) => x * 2) }, base);
    expect(cash.fills).toEqual([]);
  });

  it('weighs calmer picks more (volWeight) and scales down to a target volatility', () => {
    const calm = series(
      100,
      [0.01, 0.012, 0.009, 0.011, 0.01, 0.012, 0.01, 0.011],
    );
    const wild = series(
      100,
      [0.06, -0.04, 0.07, -0.03, 0.06, -0.02, 0.05, 0.02],
    );
    const weighted = run(
      { CALM: calm, WILD: wild },
      { ...base, topN: '2', volWeight: '1', rebalanceDays: '100' },
    );
    const value = (s: string) =>
      weighted.fills
        .filter((f) => f.symbol === s)
        .reduce((n, f) => n + f.qty * f.price, 0);
    expect(value('CALM')).toBeGreaterThan(value('WILD') * 2);

    const full = run(
      { WILD: wild, CALM: calm },
      { ...base, rebalanceDays: '100' },
    );
    const targeted = run(
      { WILD: wild, CALM: calm },
      { ...base, rebalanceDays: '100', targetVol: '10' },
    );
    expect(targeted.fills[0].qty).toBeLessThan(full.fills[0].qty / 2);
    expect(targeted.fills[0].reason).toMatch(/sized to 10% volatility$/);
  });

  it('skips trades smaller than the band, and checks its settings', () => {
    const up = series(100, Array(11).fill(0.01));
    const faster = series(100, Array(11).fill(0.03)); // drifts away from an equal split
    const noBand = run(
      { A: up, B: faster },
      { ...base, topN: '2', rebalanceDays: '1' },
    );
    const banded = run(
      { A: up, B: faster },
      { ...base, topN: '2', rebalanceDays: '1', band: '5' },
    );
    expect(banded.fills.length).toBeLessThan(noBand.fills.length);
    expect(() =>
      createStrategy('momentum-rotation', ['A', 'B'], { topN: '3' }),
    ).toThrow(/topN \(3\) is more than the 2 symbols/);
    expect(() =>
      createStrategy('momentum-rotation', ['TLT'], { safeLast: '1' }),
    ).toThrow(/at least one symbol to rank/);
  });
});

describe('rules: volatility-targeted sizing', () => {
  it('buys a smaller position in a jumpier stock', () => {
    const bars = (closes: number[]): StrategyBar[] => makeBars('AAA', closes);
    const jumpy = [10, 11, 10, 11.5, 10.2, 11.8, 10.5, 12.5, 13, 14];
    const r = (targetVol: string) =>
      runBacktest(
        createStrategy('rules', ['AAA'], {
          breakout: '3',
          allocation: '1',
          targetVol,
          targetVolDays: '5',
        }),
        { AAA: bars(jumpy) },
        options,
      );
    expect(r('20').fills[0].qty).toBeLessThan(r('0').fills[0].qty / 3);
  });
});
