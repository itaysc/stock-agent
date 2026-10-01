import { SMA } from 'trading-signals';
import type {
  Strategy,
  StrategyBar,
  StrategyContext,
} from './strategy.types.js';

export interface SmaCrossoverParams {
  symbols: string[];
  /** Fast moving-average length, in bars. */
  fast: number;
  /** Slow moving-average length, in bars. */
  slow: number;
  /** Fraction of available cash to spend on each buy (0-1]. */
  allocation: number;
}

interface SymbolState {
  fast: SMA;
  slow: SMA;
  fastAbove?: boolean;
}

/**
 * Example strategy: buy when the fast SMA crosses above the slow SMA, sell the
 * whole position when it crosses back below. Long-only, whole shares.
 */
export class SmaCrossoverStrategy implements Strategy {
  readonly name = 'sma-crossover';
  private readonly state = new Map<string, SymbolState>();

  constructor(private readonly params: SmaCrossoverParams) {
    if (params.fast >= params.slow) {
      throw new Error('sma-crossover: fast must be shorter than slow');
    }
    if (params.allocation <= 0 || params.allocation > 1) {
      throw new Error('sma-crossover: allocation must be in (0, 1]');
    }
  }

  get symbols(): string[] {
    return this.params.symbols;
  }

  get warmupBars(): number {
    return this.params.slow + 1; // slow SMA + one bar to detect a cross
  }

  onBar(bar: StrategyBar, ctx: StrategyContext): void {
    const s = this.stateFor(bar.symbol);
    const fast = s.fast.add(bar.close);
    const slow = s.slow.add(bar.close);
    if (fast === null || slow === null) return; // not enough bars yet

    const fastAbove = fast > slow;
    const crossed = s.fastAbove !== undefined && fastAbove !== s.fastAbove;
    s.fastAbove = fastAbove;
    if (!crossed) return;

    const held = ctx.position(bar.symbol)?.qty ?? 0;
    if (fastAbove && held === 0) {
      const qty = Math.floor((ctx.cash() * this.params.allocation) / bar.close);
      if (qty > 0) ctx.buy(bar.symbol, qty, 'fast SMA crossed above slow');
    } else if (!fastAbove && held > 0) {
      ctx.sell(bar.symbol, held, 'fast SMA crossed below slow');
    }
  }

  private stateFor(symbol: string): SymbolState {
    let s = this.state.get(symbol);
    if (!s) {
      s = { fast: new SMA(this.params.fast), slow: new SMA(this.params.slow) };
      this.state.set(symbol, s);
    }
    return s;
  }
}
