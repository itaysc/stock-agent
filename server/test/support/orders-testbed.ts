import type { streaming, trading } from '@alpacahq/alpaca-trade-api';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import { Subject } from 'rxjs';
import { AlpacaStreamService } from '../../src/alpaca/alpaca-stream.service.js';
import { AlpacaService } from '../../src/alpaca/alpaca.service.js';
import {
  OrderEvent,
  OrderEventSchema,
} from '../../src/orders/order-event.schema.js';
import { OrderLogService } from '../../src/orders/order-log.service.js';
import { Order, OrderSchema } from '../../src/orders/order.schema.js';
import { OrdersService } from '../../src/orders/orders.service.js';
import { RiskService } from '../../src/risk/risk.service.js';

/** Orders module wired to an in-memory MongoDB, a fake AlpacaService and a fake trade stream. */
export async function createOrdersTestbed() {
  const mongo = await MongoMemoryServer.create();
  const tradeUpdates = new Subject<streaming.TradeUpdate>();
  const alpaca = { isPaper: true, placeOrder: vi.fn() };
  const risk = { check: vi.fn() };

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      MongooseModule.forRoot(mongo.getUri('orders-test')),
      MongooseModule.forFeature([
        { name: Order.name, schema: OrderSchema },
        { name: OrderEvent.name, schema: OrderEventSchema },
      ]),
    ],
    providers: [
      OrderLogService,
      OrdersService,
      { provide: AlpacaService, useValue: alpaca },
      { provide: RiskService, useValue: risk },
      {
        provide: AlpacaStreamService,
        useValue: { tradeUpdates$: tradeUpdates.asObservable() },
      },
    ],
  }).compile();
  await moduleRef.init();

  const orders = moduleRef.get<Model<Order>>(getModelToken(Order.name));
  const events = moduleRef.get<Model<OrderEvent>>(
    getModelToken(OrderEvent.name),
  );

  return {
    alpaca,
    risk,
    tradeUpdates,
    orders,
    events,
    ordersService: moduleRef.get(OrdersService),
    findOrder: (clientOrderId: string) =>
      orders.findOne({ clientOrderId }).lean(),
    reset: async () => {
      alpaca.placeOrder.mockReset();
      risk.check.mockReset();
      await Promise.all([orders.deleteMany({}), events.deleteMany({})]);
    },
    close: async () => {
      await moduleRef.close();
      await mongo.stop();
    },
  };
}

export type OrdersTestbed = Awaited<ReturnType<typeof createOrdersTestbed>>;

export const marketBuy = (clientOrderId: string) =>
  ({
    type: 'market',
    side: 'buy',
    symbol: 'AAPL',
    qty: 2,
    timeInForce: 'day',
    clientOrderId,
  }) as const;

export const alpacaOrder = (
  clientOrderId: string,
  fields: Partial<trading.Order> = {},
) =>
  ({
    id: `alpaca-${clientOrderId}`,
    clientOrderId,
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    timeInForce: 'day',
    qty: '2',
    notional: null,
    status: 'accepted',
    filledQty: '0',
    ...fields,
  }) as trading.Order;

export const tradeUpdate = (
  event: streaming.TradeUpdateEvent,
  order: trading.Order,
  fields: Partial<streaming.TradeUpdate> = {},
): streaming.TradeUpdate => ({
  event,
  order,
  timestamp: new Date('2026-09-26T14:30:00Z'),
  ...fields,
});
