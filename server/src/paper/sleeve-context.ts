import type {
  Position,
  StrategyContext,
} from '../strategies/strategy.types.js';
import type { SleeveLedger } from './deployment.types.js';

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  reason?: string;
}

/**
 * What a deployed strategy sees: its sleeve's own cash and positions (not the
 * whole account). Orders are collected, and the runner sends them after the
 * bar, the way the backtest fills them at the next open.
 */
export class SleeveContext implements StrategyContext {
  /** False while replaying history to warm the indicators up. */
  acceptingOrders = false;
  readonly orders: OrderRequest[] = [];
  private clock = new Date();

  constructor(private readonly ledger: SleeveLedger) {}

  setTime(t: Date): void {
    this.clock = t;
  }

  now(): Date {
    return this.clock;
  }

  /** Cash minus what already-requested buys will cost (at the last close). */
  cash(): number {
    const committed = this.orders
      .filter((o) => o.side === 'buy')
      .reduce((n, o) => n + o.qty * (this.ledger.lastPrices[o.symbol] ?? 0), 0);
    return this.ledger.cash - committed;
  }

  position(symbol: string): Position | undefined {
    return this.ledger.positions[symbol];
  }

  buy(symbol: string, qty: number, reason?: string): void {
    this.request({ symbol, side: 'buy', qty, reason });
  }

  sell(symbol: string, qty: number, reason?: string): void {
    this.request({ symbol, side: 'sell', qty, reason });
  }

  private request(order: OrderRequest): void {
    if (!this.acceptingOrders || !(order.qty > 0)) return;
    // One order per symbol at a time, like the live runner.
    const busy =
      this.ledger.pending.some((p) => p.symbol === order.symbol) ||
      this.orders.some((o) => o.symbol === order.symbol);
    if (!busy) this.orders.push({ ...order, qty: Math.floor(order.qty) });
  }
}
