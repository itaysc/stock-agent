import { randomUUID } from 'node:crypto';
import type { streaming } from '@alpacahq/alpaca-trade-api';
import type { Logger } from '@nestjs/common';
import type { AlpacaService } from '../alpaca/alpaca.service.js';
import type { OrdersService } from '../orders/orders.service.js';
import type {
  Fill,
  OrderSide,
  Position,
  StrategyContext,
} from '../strategies/strategy.types.js';

const TERMINAL_EVENTS = new Set<streaming.TradeUpdateEvent>([
  'fill',
  'canceled',
  'expired',
  'rejected',
  'done_for_day',
]);

/**
 * The live implementation of StrategyContext. Cash and positions are cached
 * (strategies read them synchronously) and refreshed from Alpaca after fills.
 * Orders go through OrdersService, so they pass the risk checks and are logged.
 *
 * At most one order per symbol is in flight: a new order for a symbol is
 * skipped until the previous one is done, so a slow fill can't double a position.
 */
export class LiveContext implements StrategyContext {
  /** False while replaying warm-up history: orders are ignored. */
  acceptingOrders = false;
  private cashValue = 0;
  private positions = new Map<string, Position>();
  private readonly inFlight = new Map<string, string>(); // clientOrderId -> symbol

  constructor(
    private readonly strategyName: string,
    private readonly alpaca: AlpacaService,
    private readonly orders: OrdersService,
    private readonly logger: Logger,
  ) {}

  async refresh(): Promise<void> {
    const [account, positions] = await Promise.all([
      this.alpaca.getAccount(),
      this.alpaca.getPositions(),
    ]);
    this.cashValue = Number(account.cash ?? 0);
    this.positions = new Map(
      positions.map((p) => [
        p.symbol,
        {
          symbol: p.symbol,
          qty: Number(p.qty),
          avgPrice: Number(p.avgEntryPrice),
        },
      ]),
    );
  }

  now(): Date {
    return new Date();
  }

  cash(): number {
    return this.cashValue;
  }

  position(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  hasOrderInFlight(symbol: string): boolean {
    return [...this.inFlight.values()].includes(symbol);
  }

  buy(symbol: string, qty: number, reason?: string): void {
    this.submit('buy', symbol, qty, reason);
  }

  sell(symbol: string, qty: number, reason?: string): void {
    this.submit('sell', symbol, qty, reason);
  }

  /** Feeds a trade update; returns a Fill if it belongs to this strategy's order. */
  async onTradeUpdate(
    update: streaming.TradeUpdate,
  ): Promise<Fill | undefined> {
    const clientOrderId = update.order.clientOrderId;
    if (!clientOrderId || !this.inFlight.has(clientOrderId)) return undefined;
    if (TERMINAL_EVENTS.has(update.event)) this.inFlight.delete(clientOrderId);
    if (update.event !== 'fill' && update.event !== 'partial_fill')
      return undefined;

    await this.refresh().catch((err: Error) =>
      this.logger.warn(`[${this.strategyName}] refresh failed: ${err.message}`),
    );
    return {
      symbol: update.order.symbol ?? '',
      side: update.order.side as OrderSide,
      qty: Number(update.qty ?? 0),
      price: Number(update.price ?? 0),
      fee: 0,
      timestamp: update.timestamp ?? new Date(),
    };
  }

  private submit(
    side: OrderSide,
    symbol: string,
    qty: number,
    reason?: string,
  ) {
    if (!this.acceptingOrders) return;
    if (this.hasOrderInFlight(symbol)) {
      this.logger.warn(
        `[${this.strategyName}] skipped ${side} ${symbol}: previous order still open`,
      );
      return;
    }

    const clientOrderId = `${this.strategyName}-${symbol}-${randomUUID()}`;
    this.inFlight.set(clientOrderId, symbol);
    this.logger.log(
      `[${this.strategyName}] ${side} ${qty} ${symbol}${reason ? ` (${reason})` : ''}`,
    );
    this.orders
      .placeOrder({
        type: 'market',
        side,
        symbol,
        qty,
        timeInForce: 'day',
        clientOrderId,
      })
      .catch((err: Error) => {
        this.inFlight.delete(clientOrderId);
        this.logger.warn(
          `[${this.strategyName}] ${side} ${symbol} not placed: ${err.message}`,
        );
      });
  }
}
