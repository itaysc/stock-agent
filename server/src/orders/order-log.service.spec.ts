import {
  alpacaOrder,
  createOrdersTestbed,
  marketBuy,
  type OrdersTestbed,
  tradeUpdate,
} from '../../test/support/orders-testbed.js';

describe('OrderLogService trade updates', () => {
  let t: OrdersTestbed;

  beforeAll(async () => {
    t = await createOrdersTestbed();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  it('appends events and updates the order as it fills', async () => {
    t.alpaca.placeOrder.mockResolvedValue(alpacaOrder('ord-1'));
    await t.ordersService.placeOrder(marketBuy('ord-1'));

    t.tradeUpdates.next(
      tradeUpdate('new', alpacaOrder('ord-1', { status: 'new' })),
    );
    t.tradeUpdates.next(
      tradeUpdate(
        'fill',
        alpacaOrder('ord-1', {
          status: 'filled',
          filledQty: '2',
          filledAvgPrice: '190.25',
        }),
        { price: '190.25', qty: '2', positionQty: '2', executionId: 'exec-1' },
      ),
    );

    await vi.waitFor(async () =>
      expect(await t.findOrder('ord-1')).toMatchObject({
        status: 'filled',
        filledQty: '2',
        filledAvgPrice: '190.25',
      }),
    );
    const events = await t.events
      .find({ clientOrderId: 'ord-1' })
      .sort({ createdAt: 1 })
      .lean();
    expect(events.map((e) => e.event)).toEqual(['new', 'fill']);
    expect(events[1]).toMatchObject({
      price: '190.25',
      qty: '2',
      positionQty: '2',
      executionId: 'exec-1',
    });
  });

  it('keeps a stream status that arrived before the REST response', async () => {
    t.alpaca.placeOrder.mockImplementation(async () => {
      // The fill lands via the stream while the POST response is still in flight.
      t.tradeUpdates.next(
        tradeUpdate('fill', alpacaOrder('ord-2', { status: 'filled' })),
      );
      await vi.waitFor(async () =>
        expect(await t.findOrder('ord-2')).toMatchObject({ status: 'filled' }),
      );
      return alpacaOrder('ord-2', { status: 'accepted' });
    });

    await t.ordersService.placeOrder(marketBuy('ord-2'));

    expect(await t.findOrder('ord-2')).toMatchObject({
      status: 'filled',
      alpacaOrderId: 'alpaca-ord-2',
    });
  });

  it('records orders placed outside the app as external', async () => {
    t.tradeUpdates.next(
      tradeUpdate(
        'new',
        alpacaOrder('dashboard-1', {
          symbol: 'MSFT',
          status: 'new',
          type: 'limit',
          limitPrice: '400',
        }),
      ),
    );

    await vi.waitFor(async () =>
      expect(await t.findOrder('dashboard-1')).toMatchObject({
        source: 'external',
        paper: true,
        symbol: 'MSFT',
        status: 'new',
        type: 'limit',
        limitPrice: '400',
      }),
    );
  });

  it('keeps processing after an update it cannot save', async () => {
    const create = vi
      .spyOn(t.events, 'create')
      .mockRejectedValueOnce(new Error('db write failed'));

    t.tradeUpdates.next(
      tradeUpdate('new', alpacaOrder('ord-3', { status: 'new' })),
    );
    t.tradeUpdates.next(
      tradeUpdate('new', alpacaOrder('ord-4', { status: 'new' })),
    );

    await vi.waitFor(async () =>
      expect(await t.findOrder('ord-4')).toMatchObject({ status: 'new' }),
    );
    expect(await t.findOrder('ord-3')).toBeNull();
    create.mockRestore();
  });
});
