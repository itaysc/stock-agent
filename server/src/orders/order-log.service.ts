import type { streaming, trading } from '@alpacahq/alpaca-trade-api';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { concatMap, type Subscription } from 'rxjs';
import { AlpacaStreamService } from '../alpaca/alpaca-stream.service.js';
import {
  AlpacaService,
  type PlaceOrderInput,
} from '../alpaca/alpaca.service.js';
import { OrderEvent } from './order-event.schema.js';
import { type LocalOrderStatus, Order } from './order.schema.js';

export class DuplicateClientOrderIdError extends Error {
  constructor(readonly clientOrderId: string) {
    super(`clientOrderId "${clientOrderId}" was already used`);
    this.name = 'DuplicateClientOrderIdError';
  }
}

const amount = (value: number | string | null | undefined) =>
  value === undefined || value === null ? undefined : String(value);

const isDuplicateKeyError = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  err.code === 11000;

/**
 * Persists every order and every trade update to MongoDB. Stream updates are
 * written one at a time, in arrival order, so a later event never loses to an
 * earlier one.
 */
@Injectable()
export class OrderLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderLogService.name);
  private subscription?: Subscription;

  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(OrderEvent.name) private readonly events: Model<OrderEvent>,
    private readonly alpaca: AlpacaService,
    private readonly streams: AlpacaStreamService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Make sure the unique clientOrderId index exists before any order is placed.
    await Promise.all([this.orders.init(), this.events.init()]);

    this.subscription = this.streams.tradeUpdates$
      .pipe(concatMap((update) => this.safeRecordTradeUpdate(update)))
      .subscribe();
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** Saves the order before it is sent. Throws DuplicateClientOrderIdError if the id was used. */
  recordIntent(input: PlaceOrderInput): Promise<void> {
    return this.create(input, 'pending_submit');
  }

  /** Saves an order the risk checks blocked, with the reason. */
  recordRiskRejected(input: PlaceOrderInput, reason: string): Promise<void> {
    return this.create(input, 'risk_rejected', reason);
  }

  private async create(
    input: PlaceOrderInput,
    status: LocalOrderStatus,
    error?: string,
  ): Promise<void> {
    try {
      await this.orders.create({
        clientOrderId: input.clientOrderId,
        status,
        error,
        paper: this.alpaca.isPaper,
        source: 'app',
        symbol: input.symbol ?? '',
        side: input.side,
        type: input.type,
        timeInForce: input.timeInForce,
        qty: amount(input.qty),
        notional: amount(input.notional),
        limitPrice: amount(input.limitPrice),
        stopPrice: amount(input.stopPrice),
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new DuplicateClientOrderIdError(input.clientOrderId);
      }
      throw err;
    }
  }

  /** Records Alpaca's response. Never overrides a status the stream already set. */
  async recordSubmitted(
    clientOrderId: string,
    order: trading.Order,
  ): Promise<void> {
    await this.orders.updateOne(
      { clientOrderId },
      { $set: { alpacaOrderId: order.id, submittedAt: order.submittedAt } },
    );
    await this.orders.updateOne(
      { clientOrderId, status: 'pending_submit' },
      { $set: { status: order.status ?? 'new' } },
    );
  }

  async recordSubmitFailed(
    clientOrderId: string,
    status: 'submit_failed' | 'unknown',
    error: string,
  ): Promise<void> {
    await this.orders.updateOne(
      { clientOrderId, status: 'pending_submit' },
      { $set: { status, error } },
    );
  }

  /** Appends the event and updates the order; creates it if it was placed outside this app. */
  async recordTradeUpdate(update: streaming.TradeUpdate): Promise<void> {
    const { order } = update;
    const clientOrderId = order.clientOrderId;
    if (!clientOrderId) {
      this.logger.warn(
        `Trade update without clientOrderId (order ${order.id})`,
      );
      return;
    }

    await this.events.create({
      clientOrderId,
      alpacaOrderId: order.id,
      event: update.event,
      status: order.status,
      timestamp: update.timestamp,
      price: update.price,
      qty: update.qty,
      positionQty: update.positionQty,
      executionId: update.executionId,
    });

    await this.orders.updateOne(
      { clientOrderId },
      {
        $set: {
          alpacaOrderId: order.id,
          status: order.status ?? update.event,
          filledQty: order.filledQty,
          filledAvgPrice: amount(order.filledAvgPrice),
        },
        $setOnInsert: {
          source: 'external',
          paper: this.alpaca.isPaper,
          symbol: order.symbol ?? '',
          side: order.side,
          type: order.type,
          timeInForce: order.timeInForce,
          qty: amount(order.qty),
          notional: amount(order.notional),
          limitPrice: amount(order.limitPrice),
          stopPrice: amount(order.stopPrice),
          submittedAt: order.submittedAt,
        },
      },
      { upsert: true },
    );
  }

  private async safeRecordTradeUpdate(
    update: streaming.TradeUpdate,
  ): Promise<void> {
    try {
      await this.recordTradeUpdate(update);
    } catch (err) {
      this.logger.error(
        `Failed to save ${update.event} for ${update.order.clientOrderId}: ${(err as Error).message}`,
      );
    }
  }
}
