import type { StrategyBar } from '../strategies/strategy.types.js';

const MINUTE = 60_000;

/**
 * Builds N-minute bars from 1-minute bars for one symbol. Buckets are aligned
 * to UTC (like Alpaca's historical bars), so live and backtest bars match.
 *
 * A bucket is emitted when its last minute arrives, or, if that minute had no
 * trades (common on IEX), when the first bar of a later bucket arrives.
 */
export class BarAggregator {
  private current?: StrategyBar;
  private currentBucket?: number;

  constructor(private readonly minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 1) {
      throw new Error('minutes must be a positive integer');
    }
  }

  /** Adds a 1-minute bar; returns the completed bars (0, 1 or 2). */
  add(bar: StrategyBar): StrategyBar[] {
    if (this.minutes === 1) return [bar];

    const minuteIndex = Math.floor(bar.timestamp.getTime() / MINUTE);
    const bucket = Math.floor(minuteIndex / this.minutes);
    const completed: StrategyBar[] = [];

    if (this.current && this.currentBucket !== bucket) {
      completed.push(this.current); // previous bucket never got its last minute
      this.current = undefined;
    }

    if (!this.current) {
      this.current = {
        ...bar,
        timestamp: new Date(bucket * this.minutes * MINUTE),
      };
      this.currentBucket = bucket;
    } else {
      this.current = {
        ...this.current,
        high: Math.max(this.current.high, bar.high),
        low: Math.min(this.current.low, bar.low),
        close: bar.close,
        volume: this.current.volume + bar.volume,
        tradeCount: (this.current.tradeCount ?? 0) + (bar.tradeCount ?? 0),
        vwap: undefined, // not derivable exactly from minute vwaps
      };
    }

    const isLastMinute = (minuteIndex + 1) % this.minutes === 0;
    if (isLastMinute) {
      completed.push(this.current);
      this.current = undefined;
      this.currentBucket = undefined;
    }
    return completed;
  }
}
