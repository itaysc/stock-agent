import type { streaming } from '@alpacahq/alpaca-trade-api';
import { Logger } from '@nestjs/common';
import type { AlpacaService } from '../alpaca/alpaca.service.js';
import type { OrdersService } from '../orders/orders.service.js';
import { LiveContext } from './live-context.js';

function setup() {
  const alpaca = {
    getAccount: vi.fn(async () => ({ cash: '5000' })),
    getPositions: vi.fn(async () => [
      { symbol: 'AAPL', qty: '3', avgEntryPrice: '190.5' },
    ]),
  };
  const orders = { placeOrder: vi.fn(async () => ({})) };
  const ctx = new LiveContext(
    'sma-crossover',
    alpaca as unknown as AlpacaService,
    orders as unknown as OrdersService,
    new Logger('test'),
  );
  return { ctx, alpaca, orders };
}

const update = (
  event: streaming.TradeUpdateEvent,
  clientOrderId: string,
): streaming.TradeUpdate => ({
  event,
  price: '191',
  qty: '2',
  timestamp: new Date('2026-09-28T14:31:00Z'),
  order: { clientOrderId, symbol: 'AAPL', side: 'buy' } as never,
});

describe('LiveContext', () => {
  it('caches cash and positions from Alpaca', async () => {
    const { ctx } = setup();
    await ctx.refresh();
    expect(ctx.cash()).toBe(5000);
    expect(ctx.position('AAPL')).toEqual({
      symbol: 'AAPL',
      qty: 3,
      avgPrice: 190.5,
    });
  });

  it('ignores orders during warm-up', () => {
    const { ctx, orders } = setup();
    ctx.buy('AAPL', 1);
    expect(orders.placeOrder).not.toHaveBeenCalled();
  });

  it('places market day orders with a unique, strategy-prefixed clientOrderId', () => {
    const { ctx, orders } = setup();
    ctx.acceptingOrders = true;
    ctx.buy('AAPL', 2, 'signal');
    ctx.sell('MSFT', 1);

    const [[first], [second]] = orders.placeOrder.mock.calls as unknown as [
      [{ clientOrderId: string }],
      [{ clientOrderId: string }],
    ];
    expect(first).toMatchObject({
      type: 'market',
      side: 'buy',
      symbol: 'AAPL',
      qty: 2,
      timeInForce: 'day',
    });
    expect(first.clientOrderId).toMatch(/^sma-crossover-AAPL-/);
    expect(second.clientOrderId).not.toBe(first.clientOrderId);
  });

  it('allows one order per symbol until it is done', async () => {
    const { ctx, orders, alpaca } = setup();
    ctx.acceptingOrders = true;
    ctx.buy('AAPL', 2);
    ctx.buy('AAPL', 2); // skipped: previous still open
    expect(orders.placeOrder).toHaveBeenCalledTimes(1);

    const [[placed]] = orders.placeOrder.mock.calls as unknown as [
      [{ clientOrderId: string }],
    ];
    const fill = await ctx.onTradeUpdate(update('fill', placed.clientOrderId));

    expect(fill).toMatchObject({
      symbol: 'AAPL',
      side: 'buy',
      qty: 2,
      price: 191,
    });
    expect(alpaca.getPositions).toHaveBeenCalled(); // refreshed after the fill
    ctx.buy('AAPL', 2);
    expect(orders.placeOrder).toHaveBeenCalledTimes(2);
  });

  it('frees the symbol when the order is rejected before reaching Alpaca', async () => {
    const { ctx, orders } = setup();
    orders.placeOrder.mockRejectedValueOnce(new Error('daily loss limit'));
    ctx.acceptingOrders = true;
    ctx.buy('AAPL', 2);
    await vi.waitFor(() => expect(ctx.hasOrderInFlight('AAPL')).toBe(false));
  });

  it('ignores updates for orders it did not place', async () => {
    const { ctx } = setup();
    expect(
      await ctx.onTradeUpdate(update('fill', 'someone-else')),
    ).toBeUndefined();
  });
});
