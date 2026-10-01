import { makeBars } from '../../../test/support/bars.js';
import { runBacktest } from '../../backtest/backtest-engine.js';
import type { BarEarnings, StrategyBar } from '../strategy.types.js';
import { createStrategy } from '../strategy-registry.js';
import { infoNeeds, usesMarket } from './rules-validate.js';

const options = { initialCash: 10_000, slippageBps: 0, feePerShare: 0 };
const off = { breakout: '0', trailingStop: '0', allocation: '1' };
const reasons = (r: ReturnType<typeof runBacktest>) =>
  r.fills.map((f) => `${f.side}: ${f.reason}`);
const run = (
  params: Record<string, string>,
  bars: StrategyBar[],
  spy?: StrategyBar[],
) =>
  runBacktest(
    createStrategy('rules', ['AAA'], { ...off, ...params }),
    { AAA: bars },
    options,
    { market: spy ? { SPY: spy } : {} },
  );

describe('information blocks', () => {
  it('market calm: buys only while SPY is calm, sells when it turns turbulent', () => {
    const calm = Array.from({ length: 10 }, (_, i) => 100 + i * 0.1);
    const wild = [104, 96, 105, 94, 106];
    const spy = makeBars('SPY', [...calm, ...wild]);
    const aaa = makeBars(
      'AAA',
      Array.from({ length: 15 }, () => 10),
    );
    const r = run(
      { volMax: '20', volExit: '60', volPeriod: '5', maxHold: '0' },
      aaa,
      spy,
    );
    expect(reasons(r)[0]).toMatch(/^buy: calm market \(volatility \d+%\)$/);
    expect(reasons(r)[1]).toMatch(/^sell: market volatility \d+%$/);
  });

  it('news: buys on good headlines and sells on bad ones', () => {
    const bars = makeBars('AAA', [10, 10, 10, 10, 10, 10]);
    const tones = [0, 0.6, 0, 0, -0.8, 0];
    bars.forEach(
      (b, i) => (b.news = { tone: tones[i], count: tones[i] ? 2 : 0 }),
    );
    const r = run(
      { newsFilter: '1', newsMin: '0.3', newsDays: '1', newsExit: '0.5' },
      bars,
    );
    expect(reasons(r)).toEqual([
      'buy: news tone 0.60',
      'sell: bad news (tone -0.80)',
    ]);
  });

  it('earnings: buys after a beat, and sells before the next report', () => {
    const bars = makeBars('AAA', [10, 10, 10, 10, 10, 10]);
    const e: BarEarnings[] = [
      { daysToNext: 30, daysSinceLast: 60, lastSurprisePct: 1 },
      { daysToNext: 25, daysSinceLast: 1, lastSurprisePct: 8 }, // just beat by 8%
      { daysToNext: 24, daysSinceLast: 2, lastSurprisePct: 8 },
      { daysToNext: 5, daysSinceLast: 20, lastSurprisePct: 8 },
      { daysToNext: 2, daysSinceLast: 23, lastSurprisePct: 8 }, // report in 2 days
      { daysToNext: 1, daysSinceLast: 24, lastSurprisePct: 8 },
    ];
    bars.forEach((b, i) => (b.earnings = e[i]));
    const r = run(
      {
        surpriseMin: '5',
        surpriseDays: '5',
        earningsAvoid: '10',
        earningsExit: '3',
      },
      bars,
    );
    expect(reasons(r)).toEqual([
      'buy: no earnings within 10 days + beat estimates by 8.0%',
      'sell: earnings in 2 days',
    ]);
  });

  it('fails loudly when its data was not loaded, and says what a run needs', () => {
    expect(() =>
      run({ newsFilter: '1', maxHold: '5' }, makeBars('AAA', [10, 11])),
    ).toThrow(/news blocks need news data/);
    expect(
      infoNeeds(['rules'], { newsExit: '0.2', surpriseMin: ['0', '5'] }),
    ).toEqual({ news: true, earnings: true });
    expect(infoNeeds(['sma-crossover'], { newsFilter: '1' })).toEqual({
      news: false,
      earnings: false,
    });
    expect(usesMarket(['rules'], { volMax: '20' })).toBe(true);
  });
});
