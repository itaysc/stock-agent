import { MARKET_SYMBOL } from '../rules/rules-validate.js';
import { cleanQty, roundQty } from '../qty.js';
import { VolTracker } from '../sizing.js';
import { rankSymbols, rotationTargets } from './rotation-targets.js';
import { holdingExits } from './rotation-exits.js';
import { RotationGuard } from './rotation-guard.js';
import { pointInTime } from './rotation-universe.js';
import type {
  Strategy,
  StrategyBar,
  StrategyContext,
} from '../strategy.types.js';

type Params = Record<string, number>;

/**
 * Momentum rotation ("dual momentum"): every `rebalanceDays`, rank the
 * symbols by their return over `lookback` bars and hold the top `topN`.
 * With absolute momentum, a pick must itself be rising; its share goes to the
 * safe asset (the last symbol, with safeLast) or stays in cash. Weights are
 * equal or inverse-volatility, optionally scaled to a target volatility.
 * Options: rank by risk-adjusted return (rankBy), hold nothing risky while
 * SPY is below its average (marketFilter), and a daily trailing stop (stopPct).
 */
export class MomentumRotationStrategy implements Strategy {
  readonly name = 'momentum-rotation';
  private readonly closes = new Map<string, number[]>();
  private readonly vols = new Map<string, VolTracker>();
  private steps = 0;
  /** SPY closes for the market filter. */
  private readonly market: number[] = [];
  /** Highest close of each held symbol since it was bought (trailing stop). */
  private readonly peaks = new Map<string, number>();
  readonly marketSymbols: string[];
  private readonly guard: RotationGuard;
  /** The latest close it saw (for a point-in-time universe in the lab). */
  private now = new Date(0);

  constructor(
    readonly symbols: string[],
    private readonly p: Params,
  ) {
    const risky = symbols.length - (p.safeLast ? 1 : 0);
    if (risky < 1)
      throw new Error(
        'momentum-rotation needs at least one symbol to rank (besides the safe asset)',
      );
    if (p.topN > risky)
      throw new Error(
        `topN (${p.topN}) is more than the ${risky} symbols to rank`,
      );
    this.marketSymbols =
      p.marketFilter > 0 || p.guardResume ? [MARKET_SYMBOL] : [];
    this.guard = new RotationGuard(p.guardPct, p.guardDays, !!p.guardResume);
  }

  onMarketBar(bar: StrategyBar): void {
    const keep = Math.max(this.p.marketFilter, this.p.guardResume ? 200 : 0);
    if (bar.symbol !== MARKET_SYMBOL || !(keep > 0)) return;
    this.market.push(bar.close);
    if (this.market.length > keep) this.market.shift();
  }

  /** SPY above its n-day average (null: not enough data). */
  private marketAbove(n: number): boolean | null {
    if (this.market.length < n) return null;
    const recent = this.market.slice(-n);
    return (recent.at(-1) ?? 0) > recent.reduce((a, b) => a + b, 0) / n;
  }

  /** Everything in the safe asset (or cash): the crash guard tripped. */
  private safeOnly(): Map<string, { weight: number; why: string }> {
    const safe = this.p.safeLast ? this.symbols.at(-1) : undefined;
    const why = `crash guard: the account fell ${this.p.guardPct}% from its peak; waiting in T-bills`;
    return new Map(safe ? [[safe, { weight: this.p.allocation, why }]] : []);
  }

  /** SPY below its marketFilter-day average (null: off, or not enough data yet). */
  private marketDown(): boolean | null {
    const n = this.p.marketFilter;
    if (!(n > 0)) return null;
    const above = this.marketAbove(n);
    return above === null ? null : !above;
  }

  get warmupBars(): number {
    return Math.max(
      this.p.lookback + this.p.skipRecent + 1,
      this.p.volLookback + 1,
      this.p.trendSma,
    );
  }

  onBar(bar: StrategyBar): void {
    const list = this.closes.get(bar.symbol) ?? [];
    list.push(bar.close);
    if (list.length > this.warmupBars) list.shift();
    this.closes.set(bar.symbol, list);
    let vol = this.vols.get(bar.symbol);
    if (!vol)
      this.vols.set(bar.symbol, (vol = new VolTracker(this.p.volLookback)));
    vol.add(bar.close);
  }

  onClose(time: Date, ctx: StrategyContext): void {
    this.now = time;
    if (!this.ready) return;
    const stopped = holdingExits(
      this.p,
      this.symbols,
      this.closes,
      this.peaks,
      ctx,
    );
    const price = (s: string) => this.closes.get(s)?.at(-1) ?? 0;
    const equity = this.symbols.reduce(
      (n, s) => n + (ctx.position(s)?.qty ?? 0) * price(s),
      ctx.cash(),
    );
    const guard = this.guard.update(equity, this.marketAbove(200));
    if (guard === 'out') return;
    // Holding nothing yet (just started, or everything was sold): invest now, not at the next re-check.
    const empty = this.symbols.every((s) => !ctx.position(s));
    if (guard === 'in' && this.steps++ % this.p.rebalanceDays !== 0 && !empty)
      return;
    const weights = guard === 'trip' ? this.safeOnly() : this.targets();
    const exitWhy =
      guard === 'trip'
        ? `crash guard: the account fell ${this.p.guardPct}% from its peak`
        : `left the top ${this.p.topN}`;
    // A symbol stopped out today is already being sold: leave it until the next re-check.
    // (Symbols without history yet have no price and no target: nothing to trade.)
    const orders = this.symbols
      .filter((s) => !stopped.has(s) && price(s) > 0)
      .map((s) => {
        const target = roundQty(
          (equity * (weights.get(s)?.weight ?? 0)) / price(s),
          !!this.p.fractional,
        );
        return {
          s,
          delta: cleanQty(target - (ctx.position(s)?.qty ?? 0)),
          why: weights.get(s)?.why ?? exitWhy,
        };
      });
    const small = (delta: number, s: string) =>
      Math.abs(delta * price(s)) < (equity * this.p.band) / 100;
    for (const o of orders)
      if (o.delta < 0 && !small(o.delta, o.s)) ctx.sell(o.s, -o.delta, o.why);
    for (const o of orders)
      if (o.delta > 0 && !small(o.delta, o.s)) ctx.buy(o.s, o.delta, o.why);
  }

  /** Above its own trendSma-day average (always true with trendSma off). */
  private aboveTrend(s: string): boolean {
    const n = this.p.trendSma;
    if (!(n > 0)) return true;
    const c = (this.closes.get(s) ?? []).slice(-n);
    return c.length === n && (c.at(-1) ?? 0) > c.reduce((a, b) => a + b, 0) / n;
  }

  /**
   * The symbols it can rank now: those with enough history (a stock listed
   * recently waits until it has a full window), and the safe asset, last.
   */
  private eligible(): string[] {
    const safe = this.p.safeLast ? this.symbols.at(-1) : undefined;
    return this.symbols.filter(
      (s) =>
        s === safe ||
        ((this.closes.get(s)?.length ?? 0) >= this.warmupBars &&
          pointInTime.allowed(s, this.now)),
    );
  }

  /** Whether it can trade: at least one symbol besides the safe asset has enough history. */
  get ready(): boolean {
    const safe = this.p.safeLast ? this.symbols.at(-1) : undefined;
    // A safe asset without history yet (e.g. BIL before 2007) leaves its share in cash.
    return this.eligible().some((s) => s !== safe);
  }

  /** Every symbol to rank, best first (e.g. "#3 of 50" on the broker page). */
  ranking(): string[] {
    return rankSymbols({
      p: this.p,
      symbols: this.eligible(),
      closes: this.closes,
      vols: this.vols,
    }).ranked;
  }

  /** Target share of the account per symbol, with the reason (what it would hold now). */
  targets(): Map<string, { weight: number; why: string }> {
    return rotationTargets({
      p: this.p,
      symbols: this.eligible(),
      closes: this.closes,
      vols: this.vols,
      marketDown: this.marketDown() === true,
      aboveTrend: (s) => this.aboveTrend(s),
    });
  }
}
