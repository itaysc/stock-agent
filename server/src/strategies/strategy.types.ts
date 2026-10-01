import type { marketDataShapes } from '@alpacahq/alpaca-trade-api';

/** News about the symbol since the previous bar (to this bar's close). */
export interface BarNews {
  /** Average headline tone, -1 (very negative) to +1 (very positive). */
  tone: number;
  count: number;
  /** Of those, the headlines published before this bar's open (overnight and pre-market; weekends too). */
  preTone: number;
  preCount: number;
}

/** Earnings reports around this bar (calendar days). */
export interface BarEarnings {
  /** Days until the next report; null when none is known. */
  daysToNext: number | null;
  /** Days since the last report, and how much it beat (+) or missed (-) the estimate, in %. */
  daysSinceLast: number | null;
  lastSurprisePct: number | null;
}

/**
 * A price bar. Historical (backtest) and live (stream) bars share this shape.
 * `news` / `earnings` are attached only when a strategy needs them.
 */
export type StrategyBar = marketDataShapes.Bar & {
  symbol: string;
  news?: BarNews;
  earnings?: BarEarnings;
};

export type OrderSide = 'buy' | 'sell';

export interface Position {
  symbol: string;
  qty: number;
  /** Average entry price, including buy fees. */
  avgPrice: number;
}

export interface Fill {
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  fee: number;
  timestamp: Date;
  /** Profit/loss realized by a sell, after fees. */
  realizedPnl?: number;
  /** Set when a buy was reduced to fit the cash at the fill price. */
  requestedQty?: number;
  reason?: string;
}

/**
 * What a strategy can see and do. The backtest broker implements it today;
 * the live runner will implement the same interface, so strategy code does
 * not change between backtest and live trading.
 */
export interface StrategyContext {
  now(): Date;
  cash(): number;
  position(symbol: string): Position | undefined;
  /** Market buy. In backtests it fills at the next bar's open. */
  buy(symbol: string, qty: number, reason?: string): void;
  /** Market sell (long-only: never more than the position). */
  sell(symbol: string, qty: number, reason?: string): void;
}

export interface Strategy {
  readonly name: string;
  readonly symbols: string[];
  /** Bars needed before signals are valid; the live runner replays this much history first. */
  readonly warmupBars?: number;
  /**
   * Symbols the strategy reads but never trades, e.g. SPY for a market filter.
   * Their bars go to onMarketBar, before the traded bars of the same time.
   */
  readonly marketSymbols?: string[];
  /** Called once per bar, after the bar closed. Only sees past and current data. */
  onBar(bar: StrategyBar, ctx: StrategyContext): void;
  onMarketBar?(bar: StrategyBar): void;
  /**
   * Called once per time step after every symbol's bar of that time was seen,
   * e.g. to rank and rebalance several symbols at once.
   */
  onClose?(time: Date, ctx: StrategyContext): void;
  onFill?(fill: Fill, ctx: StrategyContext): void;
}
