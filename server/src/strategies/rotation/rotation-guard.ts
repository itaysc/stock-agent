/**
 * The crash guard: when the whole account falls guardPct below its peak, the
 * rotation sells everything (into the safe asset) and waits: at least
 * guardDays, and with guardResume also until SPY is back above its 200-day
 * average. Then it buys again and measures the next fall from there.
 */
export class RotationGuard {
  private peak = 0;
  private out = false;
  private days = 0;

  constructor(
    private readonly pct: number,
    private readonly waitDays: number,
    private readonly resumeOnMarket: boolean,
  ) {}

  get active(): boolean {
    return this.pct > 0;
  }

  /** Every close: 'trip' the day it sells, 'out' while it waits, 'back' the day it buys again, else 'in'. */
  update(
    equity: number,
    marketUp: boolean | null,
  ): 'in' | 'trip' | 'out' | 'back' {
    if (!this.active) return 'in';
    if (!this.out) {
      this.peak = Math.max(this.peak, equity);
      if (equity > this.peak * (1 - this.pct / 100)) return 'in';
      this.out = true;
      this.days = 0;
      return 'trip';
    }
    this.days++;
    if (this.days < this.waitDays || (this.resumeOnMarket && marketUp !== true))
      return 'out';
    this.out = false;
    this.peak = equity;
    return 'back';
  }
}
