import type {
  Strategy,
  StrategyBar,
  StrategyContext,
} from '../strategy.types.js';
import {
  entryReason,
  exitReason,
  isReady,
  type Params,
  type Readings,
} from './rule-checks.js';
import { volScale } from '../sizing.js';
import { requireInfo } from './info-readings.js';
import { MarketState } from './market-state.js';
import { createSymbolState, type SymbolState } from './symbol-state.js';
import { MARKET_SYMBOL } from './rules-validate.js';

/** A cross of `now` through 0 since `before` (both known). */
const crossed = (before: number | null, now: number | null, up: boolean) =>
  before !== null &&
  now !== null &&
  (up ? before <= 0 && now > 0 : before >= 0 && now < 0);

/**
 * A strategy assembled from building blocks (see rules-params.ts): it buys
 * when every entry rule that is on holds, and sells when any exit rule that is
 * on fires. Indicators come from the trading-signals library. Long-only.
 */
export class RulesStrategy implements Strategy {
  readonly name = 'rules';
  readonly marketSymbols: string[];
  private readonly state = new Map<string, SymbolState>();
  private readonly market: MarketState;

  constructor(
    readonly symbols: string[],
    private readonly p: Params,
  ) {
    this.market = new MarketState(
      p.marketSma,
      p.volPeriod,
      p.volMax > 0 || p.volExit > 0,
    );
    this.marketSymbols = this.market.used ? [MARKET_SYMBOL] : [];
  }

  get warmupBars(): number {
    const p = this.p;
    const uses = (flag: number, bars: number) => (flag > 0 ? bars : 0);
    return Math.max(
      p.trendSma,
      p.exitTrendSma,
      p.crossSlow + 1,
      uses(p.rsiBelow || p.rsiAbove, p.rsiPeriod + 1),
      p.breakout + 1,
      p.breakdown + 1,
      uses(p.dipPct, p.dipLookback),
      p.bbPeriod,
      uses(p.macdCross || p.macdExit, p.macdSlow + p.macdSignal),
      uses(p.atrStop, p.atrPeriod + 1),
      uses(p.volumeRatio, p.volumePeriod + 1),
      p.marketSma,
      uses(p.volMax || p.volExit, p.volPeriod + 1),
      uses(p.targetVol, p.targetVolDays + 1),
    );
  }

  onMarketBar(bar: StrategyBar): void {
    if (bar.symbol === MARKET_SYMBOL) this.market.add(bar);
  }

  onBar(bar: StrategyBar, ctx: StrategyContext): void {
    requireInfo(this.p, bar);
    const s = this.stateFor(bar.symbol);
    const r = this.read(s, bar);
    const held = ctx.position(bar.symbol);
    if (!isReady(this.p, r)) return;
    if (held) {
      const h = (s.holding ??= {
        entry: held.avgPrice,
        peak: bar.close,
        barsHeld: 0,
      });
      h.entry = held.avgPrice;
      h.peak = Math.max(h.peak, bar.close);
      h.barsHeld++;
      const why = exitReason(this.p, r, bar, h);
      if (why) ctx.sell(bar.symbol, held.qty, why);
      return;
    }
    s.holding = null;
    const why = entryReason(this.p, r, bar);
    // targetVol: a jumpier stock gets a smaller position.
    const size =
      this.p.allocation * volScale(this.p.targetVol, s.sizeVol?.volPct ?? null);
    const qty = Math.floor((ctx.cash() * size) / bar.close);
    if (why && qty > 0) {
      ctx.buy(bar.symbol, qty, why);
      s.holding = { entry: bar.close, peak: bar.close, barsHeld: 0 };
    }
  }

  /** Updates every indicator with the bar and reads it. Channels are read before the bar is added. */
  private read(s: SymbolState, bar: StrategyBar): Readings {
    const candle = { high: bar.high, low: bar.low, close: bar.close };
    const channelHigh = s.breakout?.getResult()?.upper ?? null;
    const channelLow = s.breakdown?.getResult()?.lower ?? null;
    s.breakout?.add(candle);
    s.breakdown?.add(candle);
    const fast = s.fast?.add(bar.close) ?? null;
    const slow = s.slow?.add(bar.close) ?? null;
    const cross = fast !== null && slow !== null ? fast - slow : null;
    const histogram = s.macd?.add(bar.close)?.histogram ?? null;
    const r: Readings = {
      trend: s.trend?.add(bar.close) ?? null,
      exitTrend: s.exitTrend?.add(bar.close) ?? null,
      crossUp: crossed(s.prevCross, cross, true),
      crossDown: crossed(s.prevCross, cross, false),
      rsi: s.rsi?.add(bar.close) ?? null,
      channelHigh,
      channelLow,
      recentHigh:
        s.dip?.add({ high: bar.close, low: bar.close })?.upper ?? null,
      bbLower: s.bb?.add(bar.close)?.lower ?? null,
      macdUp: crossed(s.prevHistogram, histogram, true),
      macdDown: crossed(s.prevHistogram, histogram, false),
      atrStopLevel: s.chandelier?.add(candle)?.long ?? null,
      relativeVolume: s.rvol?.add(bar.volume) ?? null,
      marketUp: this.market.up,
      marketVolPct: this.market.volPct,
      news: s.news?.add(bar) ?? null,
      sizeVolPct: s.sizeVol?.add(bar.close) ?? null,
      earnings: bar.earnings ?? null,
    };
    s.prevCross = cross;
    s.prevHistogram = histogram;
    return r;
  }

  private stateFor(symbol: string): SymbolState {
    let s = this.state.get(symbol);
    if (!s) {
      s = createSymbolState(this.p);
      this.state.set(symbol, s);
    }
    return s;
  }
}
