import { makeBars } from '../../../test/support/bars.js';
import type { Strategy } from '../../strategies/strategy.types.js';
import { correlationMatrix } from './correlation.js';
import { runPortfolio } from './portfolio-engine.js';
import type { Sleeve } from './portfolio.types.js';

/** Buys everything it can whenever it holds nothing. */
const holder = (symbols: string[]): Strategy => ({
  name: 'hold',
  symbols,
  onBar: (bar, ctx) => {
    const qty = Math.floor(ctx.cash() / bar.close);
    if (!ctx.position(bar.symbol) && qty > 0) ctx.buy(bar.symbol, qty, 'buy');
  },
});
const sleeve = (symbols: string[], weightPct: number): Sleeve => ({
  strategy: 'hold',
  symbols,
  params: {},
  weightPct,
});
const part = (symbols: string[], weightPct: number) => ({
  sleeve: sleeve(symbols, weightPct),
  label: symbols.join(),
  strategy: holder(symbols),
});
const options = { initialCash: 100_000, slippageBps: 0, feePerShare: 0 };
const noStop = { maxDrawdownPct: 0, cooldownDays: 0 };

describe('runPortfolio', () => {
  it('gives each sleeve its share, keeps the rest in cash with interest, and adds it up', () => {
    const days = 366; // 365 days from first to last bar
    const bars = {
      AAA: makeBars(
        'AAA',
        Array.from({ length: days }, (_, i) => 100 + i * 0.1),
      ),
      BBB: makeBars(
        'BBB',
        Array.from({ length: days }, (_, i) => 50 - i * 0.02),
      ),
    };
    const r = runPortfolio(
      [part(['AAA'], 50), part(['BBB'], 30)],
      bars,
      { ...options, cashYieldPct: 3 },
      noStop,
    );

    expect(r.sleeves.map((s) => s.allocated)).toEqual([50_000, 30_000]);
    expect(r.reserve.allocated).toBe(20_000);
    expect(r.reserve.final).toBeCloseTo(20_000 * 1.03 ** (365 / 365.25), 4);
    const sleevesEnd = r.sleeves.reduce((n, s) => n + s.result.finalEquity, 0);
    expect(r.finalEquity).toBeCloseTo(sleevesEnd + r.reserve.final, 6);
    expect(r.sleeves[0].contribution).toBeGreaterThan(0);
    expect(r.sleeves[1].contribution).toBeLessThan(0);
    expect(r.benchmark).toHaveLength(r.equityCurve.length);
    expect(r.benchmark[0]).toBeCloseTo(100_000, 0);
    expect(r.correlation[0][1]).not.toBeNull();
  });

  it('sells everything at the portfolio stop and makes no new buys during the cooldown', () => {
    const bars = {
      AAA: makeBars('AAA', [100, 100, 100, 90, 80, 75, 70, 70, 72]),
    };
    const r = runPortfolio([part(['AAA'], 100)], bars, options, {
      maxDrawdownPct: 15,
      cooldownDays: 2,
    });

    expect(r.stops).toHaveLength(1);
    expect(r.stops[0]).toMatchObject({
      timestamp: bars.AAA[4].timestamp,
      resumesAt: bars.AAA[6].timestamp,
    });
    expect(r.stops[0].drawdownPct).toBeCloseTo(20);
    const fills = r.sleeves[0].result.fills.map(
      (f) => `${f.side} ${f.price} ${f.reason}`,
    );
    // Bought at 100, stopped out at 80's close; bar 5 is in the cooldown; buys again after it.
    expect(fills).toEqual([
      'buy 100 buy',
      'sell 80 portfolio stop',
      'buy 70 buy',
    ]);
    expect(r.metrics.maxDrawdownPct).toBeCloseTo(20);
  });

  it('measures how alike sleeves move', () => {
    expect(
      correlationMatrix([
        [1, 2, 3, 2],
        [2, 4, 6, 4],
        [5, 5, 5, 5],
      ]),
    ).toEqual([
      [1, expect.closeTo(1), null],
      [expect.closeTo(1), 1, null],
      [null, null, 1],
    ]);
  });
});
