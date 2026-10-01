import { getStandardDeviation, SMA } from 'trading-signals';
import type { StrategyBar } from '../strategy.types.js';

/** What the rules know about the whole market (SPY): above its average, and how turbulent. */
export class MarketState {
  up: boolean | null = null;
  /** Yearly volatility of daily moves over the last `volPeriod` days, in %. */
  volPct: number | null = null;
  private readonly sma?: SMA;
  private readonly closes: number[] = [];

  constructor(
    smaPeriod: number,
    private readonly volPeriod: number,
    private readonly trackVol: boolean,
  ) {
    this.sma = smaPeriod > 0 ? new SMA(smaPeriod) : undefined;
  }

  get used(): boolean {
    return this.sma !== undefined || this.trackVol;
  }

  add(bar: StrategyBar): void {
    if (this.sma) {
      const average = this.sma.add(bar.close);
      this.up = average === null ? null : bar.close > average;
    }
    if (!this.trackVol) return;
    this.closes.push(bar.close);
    if (this.closes.length > this.volPeriod + 1) this.closes.shift();
    if (this.closes.length === this.volPeriod + 1) {
      const moves = this.closes
        .slice(1)
        .map((c, i) => Math.log(c / this.closes[i]));
      this.volPct = getStandardDeviation(moves) * Math.sqrt(252) * 100;
    }
  }
}
