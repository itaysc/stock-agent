import { makeBars } from '../../../test/support/bars.js';
import { runBacktest } from '../../backtest/backtest-engine.js';
import type { StrategyBar } from '../strategy.types.js';
import { createStrategy } from '../strategy-registry.js';
import { pointInTime } from './rotation-universe.js';

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

describe('momentum rotation with fractional shares', () => {
  it('buys a fraction of a pricey stock with a small account', () => {
    const pricey = series(900, Array(11).fill(0.01));
    const whole = runBacktest(
      createStrategy('momentum-rotation', ['COST'], base),
      { COST: makeBars('COST', pricey) },
      { ...options, initialCash: 200 },
    );
    expect(whole.fills).toEqual([]); // one share costs more than the account
    const frac = runBacktest(
      createStrategy('momentum-rotation', ['COST'], {
        ...base,
        fractional: '1',
      }),
      { COST: makeBars('COST', pricey) },
      { ...options, initialCash: 200 },
    );
    expect(frac.fills[0].qty).toBeGreaterThan(0.2);
    expect(frac.fills[0].qty).toBeLessThan(1);
    expect(frac.fills[0].qty * 1e4).toBe(Math.round(frac.fills[0].qty * 1e4)); // 4 decimals
  });
});

describe('momentum rotation options', () => {
  const up = series(100, Array(11).fill(0.02));
  const calmUp = series(100, Array(11).fill(0.015));
  const jumpyUp = series(
    100,
    [0.1, -0.06, 0.1, -0.05, 0.09, -0.04, 0.08, -0.03, 0.07, -0.02, 0.06],
  );

  it('marketFilter: holds nothing risky while SPY is below its average', () => {
    const spyDown = makeBars('SPY', series(100, Array(11).fill(-0.01)));
    const r = runBacktest(
      createStrategy('momentum-rotation', ['A', 'BIL'], {
        ...base,
        safeLast: '1',
        marketFilter: '3',
      }),
      {
        A: makeBars('A', up),
        BIL: makeBars('BIL', series(100, Array(11).fill(0.0005))),
      },
      options,
      { market: { SPY: spyDown } },
    );
    expect(r.fills.every((f) => f.symbol === 'BIL')).toBe(true);
    expect(r.fills[0].reason).toBe('market down: SPY below its 3-day average');
  });

  it('stopPct: sells a holding that falls that far from its high, on any day', () => {
    const crash = series(
      100,
      [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, -0.15, 0.01, 0.01],
    );
    const r = runBacktest(
      createStrategy('momentum-rotation', ['A'], {
        ...base,
        rebalanceDays: '100',
        stopPct: '10',
      }),
      { A: makeBars('A', crash) },
      options,
    );
    const sell = r.fills.find((f) => f.side === 'sell');
    expect(sell?.reason).toMatch(/^stop: down 1\d\.\d% from its high$/);
  });

  it('rankBy 1: prefers a steady riser over a jumpier one that rose more', () => {
    const pick = (rankBy: string) =>
      runBacktest(
        createStrategy('momentum-rotation', ['CALM', 'JUMPY'], {
          ...base,
          lookback: '10',
          volLookback: '5',
          rebalanceDays: '100',
          rankBy,
        }),
        { CALM: makeBars('CALM', calmUp), JUMPY: makeBars('JUMPY', jumpyUp) },
        options,
      ).fills[0]?.symbol;
    expect(pick('0')).toBe('JUMPY');
    expect(pick('1')).toBe('CALM');
  });
});

describe('momentum rotation ranking modes', () => {
  const calm = series(
    100,
    [0.01, 0.012, 0.009, 0.011, 0.01, 0.012, 0.01, 0.011, 0.01, 0.01, 0.01],
  );
  const wild = series(
    100,
    [0.06, -0.04, 0.07, -0.03, 0.06, -0.02, 0.05, 0.02, 0.04, -0.03, 0.05],
  );
  const dip = series(
    100,
    [0.02, 0.02, 0.02, -0.03, -0.03, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
  );
  const pick = (
    params: Record<string, string>,
    bars: Record<string, number[]>,
  ) => run(bars, { ...base, rebalanceDays: '100', ...params }).fills[0]?.symbol;

  it('rankBy 2 picks the calmest, rankBy 3 the biggest recent drop', () => {
    expect(pick({ rankBy: '0' }, { CALM: calm, WILD: wild })).toBe('WILD');
    expect(
      pick({ rankBy: '2', absMomentum: '0' }, { CALM: calm, WILD: wild }),
    ).toBe('CALM');
    expect(
      pick(
        { rankBy: '3', lookback: '2', absMomentum: '0' },
        { DIP: dip, CALM: calm },
      ),
    ).toBe('DIP');
  });

  it('trendSma: only holds a symbol above its own average', () => {
    const falling = series(100, Array(11).fill(-0.01));
    expect(
      pick({ absMomentum: '0', trendSma: '5' }, { DOWN: falling, CALM: calm }),
    ).toBe('CALM');
    expect(
      pick(
        { absMomentum: '0', trendSma: '5', topN: '2' },
        { DOWN: falling, CALM: calm },
      ),
    ).toBe('CALM');
    expect(
      run(
        { DOWN: falling, CALM: calm },
        {
          ...base,
          rebalanceDays: '100',
          absMomentum: '0',
          trendSma: '5',
          topN: '2',
        },
      ).fills.map((f) => f.symbol),
    ).toEqual(['CALM']);
  });
});

describe('momentum rotation with a newly listed symbol', () => {
  it('trades the symbols with enough history, and adds a new one once it has a full window', () => {
    const old = makeBars('OLD', series(100, Array(15).fill(0.01)));
    // Listed at bar 6, rising much faster: 6 bars (the window) later it can be ranked.
    const ipo = makeBars('NEW', series(50, Array(9).fill(0.08))).map(
      (b, i) => ({
        ...b,
        timestamp: old[6 + i].timestamp,
      }),
    );
    const r = runBacktest(
      createStrategy('momentum-rotation', ['OLD', 'NEW'], {
        ...base,
        rebalanceDays: '1',
        volLookback: '5',
      }),
      { OLD: old, NEW: ipo },
      options,
    );
    expect(r.fills[0]).toMatchObject({ symbol: 'OLD', side: 'buy' }); // did not wait for NEW
    const firstNew = r.fills.find((f) => f.symbol === 'NEW');
    expect(firstNew).toMatchObject({ side: 'buy' });
    expect(firstNew!.timestamp.getTime()).toBeGreaterThan(
      old[11].timestamp.getTime(),
    ); // after its window
  });
});

describe('momentum rotation with a point-in-time universe (lab)', () => {
  afterEach(() => pointInTime.set(null));
  it('only holds the symbols allowed at each date, and sells the ones that leave', () => {
    const a = makeBars('A', series(100, Array(15).fill(0.03)));
    const b = makeBars('B', series(100, Array(15).fill(0.01)));
    const cut = a[10].timestamp;
    pointInTime.set((s, at) => s === 'B' || at < cut); // A leaves the list at bar 10
    const r = runBacktest(
      createStrategy('momentum-rotation', ['A', 'B'], {
        ...base,
        rebalanceDays: '1',
        volLookback: '5',
      }),
      { A: a, B: b },
      options,
    );
    expect(r.fills[0]).toMatchObject({ symbol: 'A', side: 'buy' }); // the stronger one, while allowed
    const soldA = r.fills.find((f) => f.symbol === 'A' && f.side === 'sell');
    expect(soldA!.timestamp.getTime()).toBeGreaterThan(cut.getTime());
    expect(r.openPositions.map((p) => p.symbol)).toEqual(['B']);
  });
});

describe('momentum rotation crash guard', () => {
  it('sells into the safe asset after a big fall, waits, then buys again', () => {
    const crash = series(
      100,
      [
        0.02, 0.02, 0.02, 0.02, 0.02, 0.02, -0.15, -0.15, 0.02, 0.03, 0.03,
        0.03, 0.03, 0.03, 0.03, 0.03,
      ],
    );
    const bil = series(100, Array(16).fill(0.0001));
    const r = runBacktest(
      createStrategy('momentum-rotation', ['A', 'BIL'], {
        ...base,
        safeLast: '1',
        rebalanceDays: '100',
        guardPct: '20',
        guardDays: '3',
      }),
      { A: makeBars('A', crash), BIL: makeBars('BIL', bil) },
      options,
    );
    const sold = r.fills.find((f) => f.symbol === 'A' && f.side === 'sell');
    expect(sold?.reason).toBe(
      'crash guard: the account fell 20% from its peak',
    );
    expect(
      r.fills.find((f) => f.symbol === 'BIL' && f.side === 'buy')?.reason,
    ).toMatch(/^crash guard: .*waiting in T-bills$/);
    const rebuy = r.fills.filter(
      (f) => f.symbol === 'A' && f.side === 'buy',
    )[1];
    expect(rebuy).toBeDefined(); // back in after the wait
    expect(
      rebuy!.timestamp.getTime() - sold!.timestamp.getTime(),
    ).toBeGreaterThanOrEqual(3 * 86_400_000);
  });
});

describe('momentum rotation sector limit', () => {
  it('holds at most maxPerSector stocks from one sector', () => {
    const fast = (k: number) => series(100, Array(11).fill(0.02 + k * 0.005));
    const run2 = (maxPerSector: string) =>
      held(
        run(
          {
            AMD: fast(4),
            AMAT: fast(3),
            NVDA: fast(2),
            XOM: fast(0),
            CAT: fast(-1),
          },
          { ...base, topN: '3', rebalanceDays: '100', maxPerSector },
        ),
      );
    expect(run2('0')).toEqual(['AMAT', 'AMD', 'NVDA']); // three chip makers
    expect(run2('2')).toEqual(['AMAT', 'AMD', 'XOM']); // the 3rd tech one makes way for energy
    expect(run2('1')).toEqual(['AMD', 'CAT', 'XOM']);
  });
});
