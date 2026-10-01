import { getStandardDeviation } from 'trading-signals';

/** Yearly volatility of daily moves over the last `days` closes, in %. */
export class VolTracker {
  volPct: number | null = null;
  private readonly closes: number[] = [];

  constructor(private readonly days: number) {}

  add(close: number): number | null {
    this.closes.push(close);
    if (this.closes.length > this.days + 1) this.closes.shift();
    if (this.closes.length === this.days + 1) {
      const moves = this.closes
        .slice(1)
        .map((c, i) => Math.log(c / this.closes[i]));
      this.volPct = getStandardDeviation(moves) * Math.sqrt(252) * 100;
    }
    return this.volPct;
  }
}

/**
 * Volatility targeting: the share of a full position to take so that a
 * position this volatile carries about `targetPct` yearly volatility (never
 * more than 1). targetPct 0 = off (always 1).
 */
export function volScale(targetPct: number, volPct: number | null): number {
  if (!(targetPct > 0) || volPct === null || volPct <= 0) return 1;
  return Math.min(1, targetPct / volPct);
}
