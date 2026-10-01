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
 */
export class MomentumRotationStrategy implements Strategy {
  readonly name = 'momentum-rotation';
  private readonly closes = new Map<string, number[]>();
  private readonly vols = new Map<string, VolTracker>();
  private steps = 0;

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
    if (this.steps++ % this.p.rebalanceDays !== 0) return;
    const weights = this.targetWeights();
    const price = (s: string) => this.closes.get(s)?.at(-1) ?? 0;
    const equity = this.symbols.reduce(
      (n, s) => n + (ctx.position(s)?.qty ?? 0) * price(s),
      ctx.cash(),
    );
    const orders = this.symbols.map((s) => {
      const target = Math.floor(
        (equity * (weights.get(s)?.weight ?? 0)) / price(s),
      );
      return {
        s,
        delta: target - (ctx.position(s)?.qty ?? 0),
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

  /** Target share of the account per symbol, with the reason. */
  private targetWeights(): Map<string, { weight: number; why: string }> {
    const p = this.p;
    const safe = p.safeLast ? this.symbols.at(-1) : undefined;
    const risky = this.symbols.filter((s) => s !== safe);
    const score = (s: string) => {
      const c = this.closes.get(s) ?? [];
      const end = c.length - 1 - p.skipRecent;
      return c[end] / c[end - p.lookback] - 1;
    };
    const ranked = [...risky].sort((a, b) => score(b) - score(a));
    const picks = ranked
      .slice(0, p.topN)
      .filter((s) => !p.absMomentum || score(s) > 0);
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
        why: `safe asset for ${p.topN - picks.length} empty slot${p.topN - picks.length === 1 ? '' : 's'}`,
      });
    }
    return out;
  }
}
