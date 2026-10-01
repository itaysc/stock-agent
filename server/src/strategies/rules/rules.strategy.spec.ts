import { makeBars } from '../../../test/support/bars.js';
import { runBacktest } from '../../backtest/backtest-engine.js';
import { createStrategy, strategyParamNames } from '../strategy-registry.js';

const options = { initialCash: 10_000, slippageBps: 0, feePerShare: 0 };
const run = (params: Record<string, string>, closes: number[]) =>
  runBacktest(
    createStrategy('rules', ['AAPL'], { allocation: '1', ...params }),
    { AAPL: makeBars('AAPL', closes) },
    options,
  );
const trades = (r: ReturnType<typeof run>) =>
  r.fills.map((f) => `${f.side} ${f.price} ${f.reason}`);

describe('rules strategy', () => {
  it('buys a breakout and sells on the trailing stop', () => {
    const r = run(
      { breakout: '3', trailingStop: '10' },
      [10, 10, 10, 10, 12, 13, 14, 12, 11],
    );
    expect(trades(r)).toEqual([
      'buy 12 3-bar breakout',
      'sell 12 trailing stop 10%', // 12 <= 14 × 0.9
    ]);
  });

  it('needs every entry rule that is on', () => {
    const closes = [10, 10, 10, 10, 12, 13, 14, 12, 11];
    // A breakout comes with a high RSI, so "breakout and RSI < 30" never buys.
    const r = run({ breakout: '3', rsiBelow: '30', rsiPeriod: '3' }, closes);
    expect(r.fills).toEqual([]);
  });

  it('exits on a stop-loss or after the max holding time', () => {
    const stop = run(
      { breakout: '3', trailingStop: '0', stopLoss: '5' },
      [10, 10, 10, 10, 12, 11.2, 11, 11],
    );
    expect(trades(stop)).toEqual([
      'buy 12 3-bar breakout',
      'sell 11.2 stop-loss 5%',
    ]);

    const hold = run(
      { breakout: '3', trailingStop: '0', maxHold: '2' },
      [10, 10, 10, 10, 12, 13, 14, 15, 16],
    );
    expect(trades(hold)).toEqual([
      'buy 12 3-bar breakout',
      'sell 14 held 2 bars',
      'buy 15 3-bar breakout', // the next breakout re-enters
    ]);
  });

  it('combines a crossover entry with its cross-down exit', () => {
    const r = run(
      {
        breakout: '0',
        trailingStop: '0',
        crossFast: '2',
        crossSlow: '4',
        crossExit: '1',
      },
      [10, 9, 8, 7, 8, 10, 12, 13, 11, 9, 8],
    );
    expect(r.fills.map((f) => f.reason)).toEqual([
      '2/4 average cross up',
      '2/4 average cross down',
    ]);
  });

  it('rejects combinations that cannot trade', () => {
    const make = (params: Record<string, string>) => () =>
      createStrategy('rules', ['AAPL'], params);
    expect(make({ trailingStop: '0' })).toThrow(/at least one exit rule/);
    expect(make({ breakout: '0' })).toThrow(/at least one entry rule/);
    expect(make({ crossFast: '5', crossSlow: '5' })).toThrow(
      /crossFast must be less than crossSlow/,
    );
    expect(make({ crossExit: '1' })).toThrow(
      /crossExit needs crossFast and crossSlow/,
    );
    expect(make({ rsiBelow: '60', rsiAbove: '40' })).toThrow(
      /rsiBelow must be less than rsiAbove/,
    );
    expect(make({ dipPct: '80' })).toThrow(/dipPct must be between 0 and 50/);
  });

  it('exposes every building block as a tunable param', () => {
    expect(strategyParamNames('rules')).toEqual(
      expect.arrayContaining([
        'trendSma',
        'rsiBelow',
        'bbPeriod',
        'trailingStop',
        'maxHold',
        'allocation',
      ]),
    );
  });
});
