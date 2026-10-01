import type { StrategyBar } from '../strategies/strategy.types.js';
import { BarAggregator } from './bar-aggregator.js';

const minuteBar = (
  hhmm: string,
  open: number,
  close: number,
  volume = 100,
) => ({
  symbol: 'AAPL',
  timestamp: new Date(`2026-09-28T${hhmm}:00Z`),
  open,
  high: Math.max(open, close) + 1,
  low: Math.min(open, close) - 1,
  close,
  volume,
  tradeCount: 10,
});

const summary = (bars: StrategyBar[]) =>
  bars.map((b) => ({
    t: b.timestamp.toISOString().slice(11, 16),
    o: b.open,
    h: b.high,
    l: b.low,
    c: b.close,
    v: b.volume,
  }));

describe('BarAggregator', () => {
  it('passes 1-minute bars straight through', () => {
    const bar = minuteBar('14:00', 1, 2);
    expect(new BarAggregator(1).add(bar)).toEqual([bar]);
  });

  it('emits a bucket when its last minute arrives', () => {
    const agg = new BarAggregator(3);
    expect(agg.add(minuteBar('14:00', 10, 11))).toEqual([]);
    expect(agg.add(minuteBar('14:01', 11, 15))).toEqual([]);
    const done = agg.add(minuteBar('14:02', 15, 12));

    expect(summary(done)).toEqual([
      { t: '14:00', o: 10, h: 16, l: 9, c: 12, v: 300 },
    ]);
    expect(done[0].tradeCount).toBe(30);
  });

  it('flushes a bucket whose last minute had no trades', () => {
    const agg = new BarAggregator(3);
    agg.add(minuteBar('14:00', 10, 11));
    agg.add(minuteBar('14:01', 11, 12)); // 14:02 missing
    const done = agg.add(minuteBar('14:04', 20, 21)); // next bucket

    expect(summary(done)).toEqual([
      { t: '14:00', o: 10, h: 13, l: 9, c: 12, v: 200 },
    ]);
    expect(summary(agg.add(minuteBar('14:05', 21, 22)))).toEqual([
      { t: '14:03', o: 20, h: 23, l: 19, c: 22, v: 200 },
    ]);
  });

  it('aligns hourly buckets to the hour', () => {
    const agg = new BarAggregator(60);
    agg.add(minuteBar('14:30', 1, 2));
    expect(summary(agg.add(minuteBar('14:59', 2, 3)))[0].t).toBe('14:00');
  });

  it('rejects invalid sizes', () => {
    expect(() => new BarAggregator(0)).toThrow();
    expect(() => new BarAggregator(1.5)).toThrow();
  });
});
