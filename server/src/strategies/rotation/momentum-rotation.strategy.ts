import { MARKET_SYMBOL } from '../rules/rules-validate.js';
import { cleanQty, roundQty } from '../qty.js';
import { volScale, VolTracker } from '../sizing.js';
import type {
  Strategy,
  StrategyBar,
  StrategyContext,
} from '../strategy.types.js';

type Params = Record<string, number>;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;

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
    this.marketSymbols = p.marketFilter > 0 ? [MARKET_SYMBOL] : [];
  }

  onMarketBar(bar: StrategyBar): void {
    if (bar.symbol !== MARKET_SYMBOL || !(this.p.marketFilter > 0)) return;
    this.market.push(bar.close);
    if (this.market.length > this.p.marketFilter) this.market.shift();
  }

  /** SPY below its marketFilter-day average (null: off, or not enough data yet). */
  private marketDown(): boolean | null {
    const n = this.p.marketFilter;
    if (!(n > 0) || this.market.length < n) return null;
    const avg = this.market.reduce((a, b) => a + b, 0) / n;
    return (this.market.at(-1) ?? 0) < avg;
  }

  get warmupBars(): number {
    return Math.max(
      this.p.lookback + this.p.skipRecent + 1,
      this.p.volLookback + 1,
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

  onClose(_time: Date, ctx: StrategyContext): void {
    if (
      !this.symbols.every(
        (s) => (this.closes.get(s)?.length ?? 0) >= this.warmupBars,
      )
    )
      return;
    const stopped = this.exits(ctx);
    // Holding nothing yet (just started, or everything was sold): invest now, not at the next re-check.
    const empty = this.symbols.every((s) => !ctx.position(s));
    if (this.steps++ % this.p.rebalanceDays !== 0 && !empty) return;
    const weights = this.targets();
    const price = (s: string) => this.closes.get(s)?.at(-1) ?? 0;
    const equity = this.symbols.reduce(
      (n, s) => n + (ctx.position(s)?.qty ?? 0) * price(s),
      ctx.cash(),
    );
    // A symbol stopped out today is already being sold: leave it until the next re-check.
    const orders = this.symbols
      .filter((s) => !stopped.has(s))
      .map((s) => {
        const target = roundQty(
          (equity * (weights.get(s)?.weight ?? 0)) / price(s),
          !!this.p.fractional,
        );
        return {
          s,
          delta: cleanQty(target - (ctx.position(s)?.qty ?? 0)),
          why: weights.get(s)?.why ?? `left the top ${this.p.topN}`,
        };
      });
    const small = (delta: number, s: string) =>
      Math.abs(delta * price(s)) < (equity * this.p.band) / 100;
    for (const o of orders)
      if (o.delta < 0 && !small(o.delta, o.s)) ctx.sell(o.s, -o.delta, o.why);
    for (const o of orders)
      if (o.delta > 0 && !small(o.delta, o.s)) ctx.buy(o.s, o.delta, o.why);
  }

  /** Every day: the stop loss (trailing: below the highest close since bought) and the take-profit. */
  private exits(ctx: StrategyContext): Set<string> {
    const stopped = new Set<string>();
    for (const s of this.symbols) {
      const close = this.closes.get(s)?.at(-1);
      if (!ctx.position(s) || close === undefined) {
        this.peaks.delete(s);
        continue;
      }
      const peak = Math.max(this.peaks.get(s) ?? close, close);
      this.peaks.set(s, peak);
      const drop = (1 - close / peak) * 100;
      const gain = (close / (ctx.position(s)?.avgPrice ?? close) - 1) * 100;
      const safe = this.p.safeLast && s === this.symbols.at(-1);
      if (this.p.takeProfitPct > 0 && !safe && gain >= this.p.takeProfitPct) {
        ctx.sell(
          s,
          ctx.position(s)?.qty ?? 0,
          `take profit: up ${gain.toFixed(1)}% from the buy price`,
        );
        this.peaks.delete(s);
        stopped.add(s);
        continue;
      }
      if (this.p.stopPct > 0 && !safe && drop >= this.p.stopPct) {
        ctx.sell(
          s,
          ctx.position(s)?.qty ?? 0,
          `stop: down ${drop.toFixed(1)}% from its high`,
        );
        this.peaks.delete(s);
        stopped.add(s);
      }
    }
    return stopped;
  }

  /** Whether every symbol has enough history to rank. */
  get ready(): boolean {
    return this.symbols.every(
      (s) => (this.closes.get(s)?.length ?? 0) >= this.warmupBars,
    );
  }

  /** Target share of the account per symbol, with the reason (what it would hold now). */
  targets(): Map<string, { weight: number; why: string }> {
    const p = this.p;
    const safe = p.safeLast ? this.symbols.at(-1) : undefined;
    const risky = this.symbols.filter((s) => s !== safe);
    const score = (s: string) => {
      const c = this.closes.get(s) ?? [];
      const end = c.length - 1 - p.skipRecent;
      return c[end] / c[end - p.lookback] - 1;
    };
    // Risk-adjusted: return per unit of volatility (steady risers beat jumpy ones).
    const rank = (s: string) =>
      p.rankBy === 1
        ? score(s) / Math.max(this.vols.get(s)?.volPct ?? 1, 1)
        : score(s);
    const ranked = [...risky].sort((a, b) => rank(b) - rank(a));
    const down = this.marketDown() === true;
    const picks = down
      ? []
      : ranked.slice(0, p.topN).filter((s) => !p.absMomentum || score(s) > 0);
    const vol = (s: string) => this.vols.get(s)?.volPct ?? null;
    const raw = picks.map((s) =>
      p.volWeight && vol(s) ? 1 / (vol(s) as number) : 1,
    );
    const rawSum = raw.reduce((a, b) => a + b, 0) || 1;
    // Each of the topN slots is 1/topN of the money; empty slots go to the safe asset or cash.
    const riskyShare = picks.length / p.topN;
    let w = picks.map((_, i) => (raw[i] / rawSum) * riskyShare);
    const avgVol =
      picks.reduce((n, s, i) => n + w[i] * (vol(s) ?? 0), 0) /
      (w.reduce((a, b) => a + b, 0) || 1);
    const scale = volScale(p.targetVol, picks.length ? avgVol : null);
    w = w.map((x) => x * scale * p.allocation);
    const out = new Map<string, { weight: number; why: string }>();
    picks.forEach((s, i) =>
      out.set(s, {
        weight: w[i],
        why: `rank ${ranked.indexOf(s) + 1}: ${pct(score(s))} over ${p.lookback} bars${scale < 1 ? `, sized to ${p.targetVol}% volatility` : ''}`,
      }),
    );
    if (safe && picks.length < p.topN) {
      out.set(safe, {
        weight: (1 - riskyShare) * p.allocation,
        why: down
          ? `market down: SPY below its ${p.marketFilter}-day average`
          : `safe asset for ${p.topN - picks.length} empty slot${p.topN - picks.length === 1 ? '' : 's'}`,
      });
    }
    return out;
  }
}
