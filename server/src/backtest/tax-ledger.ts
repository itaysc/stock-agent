/**
 * Israeli-style capital gains tax for backtests: each calendar year's realized
 * gains and losses (and interest) are netted, the net gain is taxed at `rate`
 * when the year ends, and a net loss carries forward to later years. Nominal
 * gains (Israel taxes the real, inflation-adjusted gain, so this is a bit
 * pessimistic); dividends are not modeled (prices include them).
 */
export class TaxLedger {
  private year: number | null = null;
  private gains = 0;
  private carried = 0;
  private paidSoFar = 0;

  constructor(private readonly rate: number) {}

  /** Adds a realized gain (negative: a loss) at time `t`; returns the tax due for a year that just ended. */
  record(amount: number, t: Date): number {
    const due = this.roll(t);
    this.gains += amount;
    return due;
  }

  /** At a new year: the tax due for the year that ended (0 otherwise). */
  roll(t: Date): number {
    const y = t.getUTCFullYear();
    if (this.year === null) this.year = y;
    if (y === this.year) return 0;
    this.year = y;
    const net = this.gains - this.carried;
    this.gains = 0;
    if (net <= 0) {
      this.carried = -net;
      return 0;
    }
    this.carried = 0;
    const tax = net * this.rate;
    this.paidSoFar += tax;
    return tax;
  }

  /** The tax if everything were sold now: this year's gains plus `unrealized`, less carried losses. */
  ifSoldNow(unrealized: number): number {
    const net = this.gains + unrealized - this.carried;
    return net > 0 ? net * this.rate : 0;
  }

  paid(): number {
    return this.paidSoFar;
  }
}
