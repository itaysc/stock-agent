import { RSI, SMA } from 'trading-signals';
import type {
  Strategy,
  StrategyBar,
  StrategyContext,
} from './strategy.types.js';

export interface RsiReversionParams {
  symbols: string[];
  /** RSI length, in bars. */
  period: number;
  /** Buy when RSI falls below this (oversold). */
  oversold: number;
  /** Sell when RSI rises above this (overbought). */
  overbought: number;
  /** Only buy while price is above this SMA (an uptrend). 0 disables the filter. */
  trend: number;
  /** Fraction of available cash to spend on each buy (0-1]. */
  allocation: number;
}

interface SymbolState {
  rsi: RSI;
  trend?: SMA;
}

/**
 * Mean reversion: buy a dip (RSI oversold) in a stock that is otherwise in an
 * uptrend (price above its long SMA), sell when it has bounced (RSI
 * overbought). Long-only, whole shares.
 */
export class RsiReversionStrategy implements Strategy {
  readonly name = 'rsi-reversion';
  private readonly state = new Map<string, SymbolState>();

  constructor(private readonly params: RsiReversionParams) {
    const { period, oversold, overbought, trend, allocation } = params;
    if (!Number.isInteger(period) || period < 2) {
      throw new Error('rsi-reversion: period must be an integer >= 2');
    }
    if (!(oversold > 0 && oversold < overbought && overbought < 100)) {
      throw new Error('rsi-reversion: need 0 < oversold < overbought < 100');
    }
    if (!Number.isInteger(trend) || trend < 0) {
      throw new Error('rsi-reversion: trend must be a whole number (0 = off)');
    }
    if (allocation <= 0 || allocation > 1) {
      throw new Error('rsi-reversion: allocation must be in (0, 1]');
    }
  }

  get symbols(): string[] {
    return this.params.symbols;
  }

  get warmupBars(): number {
    return Math.max(this.params.period + 1, this.params.trend);
  }

  onBar(bar: StrategyBar, ctx: StrategyContext): void {
    const s = this.stateFor(bar.symbol);
    const rsi = s.rsi.add(bar.close);
    const trend = s.trend?.add(bar.close) ?? null;
    if (rsi === null || (s.trend && trend === null)) return; // warming up

    const held = ctx.position(bar.symbol)?.qty ?? 0;
    if (held === 0 && rsi < this.params.oversold) {
      if (trend !== null && bar.close <= trend) return; // no uptrend: skip
      const qty = Math.floor((ctx.cash() * this.params.allocation) / bar.close);
      if (qty > 0) {
        ctx.buy(
          bar.symbol,
          qty,
          `RSI ${rsi.toFixed(0)} < ${this.params.oversold}`,
        );
      }
    } else if (held > 0 && rsi > this.params.overbought) {
      ctx.sell(
        bar.symbol,
        held,
        `RSI ${rsi.toFixed(0)} > ${this.params.overbought}`,
      );
    }
  }

  private stateFor(symbol: string): SymbolState {
    let s = this.state.get(symbol);
    if (!s) {
      s = {
        rsi: new RSI(this.params.period),
        trend: this.params.trend > 0 ? new SMA(this.params.trend) : undefined,
      };
      this.state.set(symbol, s);
    }
    return s;
  }
}
