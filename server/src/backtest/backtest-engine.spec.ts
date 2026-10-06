import { makeBars } from '../../test/support/bars.js';
import type {
  Strategy,
  StrategyBar,
  StrategyContext,
} from '../strategies/strategy.types.js';
import { buildTimeline, runBacktest } from './backtest-engine.js';

const options = { initialCash: 10_000, slippageBps: 0, feePerShare: 0 };

/** Places scripted orders on given bar indexes and records what it saw. */
class ScriptedStrategy implements Strategy {
  readonly name = 'scripted';
  readonly seen: Array<{ symbol: string; timestamp: Date; now: Date }> = [];
  private readonly counts = new Map<string, number>();

  constructor(
    readonly symbols: string[],
    private readonly script: Record<number, (ctx: StrategyContext) => void>,
  ) {}

  onBar(bar: StrategyBar, ctx: StrategyContext): void {
    this.seen.push({
      symbol: bar.symbol,
      timestamp: bar.timestamp,
      now: ctx.now(),
    });
    const i = this.counts.get(bar.symbol) ?? 0;
    this.counts.set(bar.symbol, i + 1);
    if (bar.symbol === this.symbols[0]) this.script[i]?.(ctx);
  }
}

describe('runBacktest', () => {
  const bars = makeBars('AAPL', [
    [100, 100],
    [101, 102],
    [103, 105],
    [106, 104],
    [104, 107],
  ]);

  it('fills orders on the next bar open and tracks equity', () => {
    const strategy = new ScriptedStrategy(['AAPL'], {
      0: (ctx) => ctx.buy('AAPL', 10),
      2: (ctx) => ctx.sell('AAPL', 10),
    });

    const result = runBacktest(strategy, { AAPL: bars }, options);

    expect(result.fills.map((f) => [f.side, f.price])).toEqual([
      ['buy', 101], // bar 1 open
      ['sell', 106], // bar 3 open
    ]);
    expect(result.fills[0].timestamp).toEqual(bars[1].timestamp);
    expect(result.finalEquity).toBe(10_050);
    expect(result.metrics.totalReturnPct).toBeCloseTo(0.5);
    expect(result.metrics.trades).toBe(1);
    expect(result.equityCurve.map((p) => p.equity)).toEqual([
      10_000, 10_010, 10_040, 10_050, 10_050,
    ]);
  });

  it('with fillAtClose fills at the same bar close (a market-on-close order)', () => {
    const strategy = new ScriptedStrategy(['AAPL'], {
      0: (ctx) => ctx.buy('AAPL', 10),
      2: (ctx) => ctx.sell('AAPL', 10),
    });
    const result = runBacktest(
      strategy,
      { AAPL: bars },
      { ...options, fillAtClose: true },
    );
    expect(result.fills.map((f) => [f.side, f.price])).toEqual([
      ['buy', 100], // bar 0 close
      ['sell', 105], // bar 2 close
    ]);
    expect(result.equityCurve.map((p) => p.equity)).toEqual([
      10_000, 10_020, 10_050, 10_050, 10_050,
    ]);
  });

  it('reports orders placed on the last bar as unfilled', () => {
    const strategy = new ScriptedStrategy(['AAPL'], {
      4: (ctx) => ctx.buy('AAPL', 1),
    });
    const result = runBacktest(strategy, { AAPL: bars }, options);
    expect(result.fills).toEqual([]);
    expect(result.unfilledOrders).toBe(1);
  });

  it('keeps an unsold position open and values it at the last close', () => {
    const strategy = new ScriptedStrategy(['AAPL'], {
      0: (ctx) => ctx.buy('AAPL', 10),
    });
    const result = runBacktest(strategy, { AAPL: bars }, options);
    expect(result.openPositions).toEqual([
      { symbol: 'AAPL', qty: 10, avgPrice: 101 },
    ]);
    expect(result.finalEquity).toBe(10_000 - 1_010 + 1_070);
  });

  it('replays multiple symbols in time order with the clock at each bar', () => {
    const aapl = makeBars('AAPL', [1, 2, 3], '2025-01-01');
    const msft = makeBars('MSFT', [5, 6], '2025-01-02');
    const strategy = new ScriptedStrategy(['AAPL', 'MSFT'], {});

    runBacktest(strategy, { AAPL: aapl, MSFT: msft }, options);

    const order = strategy.seen.map(
      (s) => `${s.timestamp.toISOString().slice(0, 10)} ${s.symbol}`,
    );
    expect(order).toEqual([
      '2025-01-01 AAPL',
      '2025-01-02 AAPL',
      '2025-01-02 MSFT',
      '2025-01-03 AAPL',
      '2025-01-03 MSFT',
    ]);
    for (const s of strategy.seen) expect(s.now).toEqual(s.timestamp);
  });
});

describe('runBacktest with startAt (warm-up)', () => {
  const bars = makeBars('AAPL', [10, 11, 12, 13, 14, 15]);

  it('shows earlier bars to the strategy but ignores its orders there', () => {
    const strategy = new ScriptedStrategy(['AAPL'], {
      0: (ctx) => ctx.buy('AAPL', 10), // warm-up: ignored
      3: (ctx) => ctx.buy('AAPL', 10), // first traded bar
    });
    const result = runBacktest(strategy, { AAPL: bars }, options, {
      startAt: bars[3].timestamp,
    });

    expect(strategy.seen).toHaveLength(6); // indicators saw every bar
    expect(result.fills.map((f) => f.price)).toEqual([13]); // bar 4 opens at bar 3's close
    expect(result.bars).toBe(3);
    expect(result.from).toEqual(bars[3].timestamp);
    expect(result.equityCurve).toHaveLength(3);
  });

  it('measures buy & hold from startAt', () => {
    const result = runBacktest(
      new ScriptedStrategy(['AAPL'], {}),
      { AAPL: bars },
      options,
      { startAt: bars[3].timestamp },
    );
    // opens at 12 (previous close) on bar 3, closes at 15
    expect(result.metrics.buyAndHoldReturnPct).toBeCloseTo(25);
  });
});

describe('runBacktest with closeAtEnd', () => {
  const bars = makeBars('AAPL', [10, 11, 12, 13, 14, 15]);

  it('sells what is still held at the last close, and drops unfilled orders', () => {
    const strategy = new ScriptedStrategy(['AAPL'], {
      1: (ctx) => ctx.buy('AAPL', 10), // fills at 11
      5: (ctx) => ctx.buy('AAPL', 10), // last bar: never fills
    });
    const result = runBacktest(
      strategy,
      { AAPL: bars },
      { ...options, slippageBps: 100 },
      { closeAtEnd: true },
    );

    const [buy, sell] = result.fills;
    expect(result.fills).toHaveLength(2);
    expect(buy.price).toBeCloseTo(11 * 1.01);
    expect(sell).toMatchObject({
      side: 'sell',
      qty: 10,
      reason: 'test window ended',
    });
    expect(sell.price).toBeCloseTo(15 * 0.99);
    expect(result.metrics.trades).toBe(1);
    expect(result.openPositions).toEqual([]);
    expect(result.unfilledOrders).toBe(0);
    expect(result.finalEquity).toBeCloseTo(
      10_000 + 10 * (15 * 0.99 - 11 * 1.01),
    );
    expect(result.equityCurve.at(-1)?.equity).toBeCloseTo(result.finalEquity);
  });
});

describe('interest on idle cash', () => {
  // 366 daily bars = exactly 365 days from the first to the last.
  const flat = makeBars(
    'AAPL',
    Array.from({ length: 366 }, () => 100),
  );

  it('pays the yearly rate on cash that stays uninvested', () => {
    const result = runBacktest(
      new ScriptedStrategy(['AAPL'], {}),
      { AAPL: flat },
      { ...options, cashYieldPct: 3 },
    );
    const expected = 10_000 * (1.03 ** (365 / 365.25) - 1);
    expect(result.interestEarned).toBeCloseTo(expected, 6);
    expect(result.finalEquity).toBeCloseTo(10_000 + expected, 6);
    expect(result.metrics.totalReturnPct).toBeCloseTo(expected / 100, 6);
  });

  it('pays nothing on money that is invested, or without a rate', () => {
    const invested = runBacktest(
      new ScriptedStrategy(['AAPL'], { 0: (ctx) => ctx.buy('AAPL', 100) }), // all 10,000
      { AAPL: flat },
      { ...options, cashYieldPct: 3 },
    );
    expect(invested.interestEarned).toBeLessThan(1); // only the first day, before the buy fills
    const none = runBacktest(
      new ScriptedStrategy(['AAPL'], {}),
      { AAPL: flat },
      options,
    );
    expect(none.interestEarned).toBe(0);
  });
});

describe('market data (read, never traded)', () => {
  it('reaches the strategy before the traded bars of the same time, and never early', () => {
    const seen: string[] = [];
    const strategy: Strategy = {
      name: 'market-probe',
      symbols: ['AAPL'],
      marketSymbols: ['SPY'],
      onMarketBar: (bar) =>
        seen.push(`SPY ${bar.timestamp.toISOString().slice(5, 10)}`),
      onBar: (bar) =>
        seen.push(`AAPL ${bar.timestamp.toISOString().slice(5, 10)}`),
    };
    const spy = makeBars('SPY', [1, 2, 3, 4]); // one more day than AAPL
    runBacktest(strategy, { AAPL: makeBars('AAPL', [10, 11, 12]) }, options, {
      market: { SPY: spy, QQQ: makeBars('QQQ', [1]) }, // QQQ: not asked for
      startAt: new Date('2025-01-02'), // warm-up gets market bars too
    });
    expect(seen).toEqual([
      'SPY 01-01',
      'AAPL 01-01',
      'SPY 01-02',
      'AAPL 01-02',
      'SPY 01-03',
      'AAPL 01-03',
    ]);
  });
});

describe('pre-open news gate', () => {
  it('skips a buy when the news before its open is bad, and only then', () => {
    const bars = makeBars('AAPL', [10, 10, 10]);
    const withNews = (preTone: number) =>
      bars.map((b, i) => ({
        ...b,
        news: {
          tone: 0,
          count: 0,
          preTone: i === 1 ? preTone : 0,
          preCount: i === 1 ? 2 : 0,
        },
      }));
    const buyOnFirstBar = () =>
      new ScriptedStrategy(['AAPL'], { 0: (ctx) => ctx.buy('AAPL', 10) });
    const run = (preTone: number, gate?: number) =>
      runBacktest(
        buyOnFirstBar(),
        { AAPL: withNews(preTone) },
        { ...options, newsGateTone: gate },
      );

    expect(run(-0.5, 0.3).fills).toEqual([]);
    expect(run(-0.5, 0.3).rejections[0].error).toBe(
      'bad news before the open (tone -0.50, 2 headlines)',
    );
    expect(run(-0.1, 0.3).fills).toHaveLength(1); // not bad enough
    expect(run(-0.5).fills).toHaveLength(1); // gate off
  });
});

describe('buildTimeline', () => {
  it('groups bars that share a timestamp', () => {
    const steps = buildTimeline({
      AAPL: makeBars('AAPL', [1, 2]),
      MSFT: makeBars('MSFT', [3, 4]),
    });
    expect(steps.map((s) => s.bars.map((b) => b.symbol))).toEqual([
      ['AAPL', 'MSFT'],
      ['AAPL', 'MSFT'],
    ]);
  });
});
