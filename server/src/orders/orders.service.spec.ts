import {
  alpacaOrder,
  createOrdersTestbed,
  marketBuy,
  type OrdersTestbed,
} from '../../test/support/orders-testbed.js';
import { RiskRejectedError } from '../risk/risk.errors.js';
import { DuplicateClientOrderIdError } from './order-log.service.js';

function fetchError(message: string) {
  const err = new Error(message);
  err.name = 'FetchError';
  return err;
}

describe('OrdersService.placeOrder', () => {
  let t: OrdersTestbed;

  beforeAll(async () => {
    t = await createOrdersTestbed();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  it('saves the intent before sending, then the Alpaca response', async () => {
    t.alpaca.placeOrder.mockImplementation(async () => {
      // The intent is already in the database while the request is in flight.
      expect(await t.findOrder('ord-1')).toMatchObject({
        status: 'pending_submit',
      });
      return alpacaOrder('ord-1');
    });

    await t.ordersService.placeOrder(marketBuy('ord-1'));

    expect(await t.findOrder('ord-1')).toMatchObject({
      clientOrderId: 'ord-1',
      alpacaOrderId: 'alpaca-ord-1',
      status: 'accepted',
      source: 'app',
      paper: true,
      symbol: 'AAPL',
      side: 'buy',
      type: 'market',
      qty: '2',
    });
  });

  it('refuses a reused clientOrderId without calling Alpaca', async () => {
    t.alpaca.placeOrder.mockResolvedValue(alpacaOrder('ord-1'));
    await t.ordersService.placeOrder(marketBuy('ord-1'));

    await expect(
      t.ordersService.placeOrder(marketBuy('ord-1')),
    ).rejects.toBeInstanceOf(DuplicateClientOrderIdError);
    expect(t.alpaca.placeOrder).toHaveBeenCalledTimes(1);
  });

  it('logs risk rejections and never sends them to Alpaca', async () => {
    t.risk.check.mockRejectedValue(
      new RiskRejectedError('daily loss limit reached'),
    );

    await expect(
      t.ordersService.placeOrder(marketBuy('ord-risk')),
    ).rejects.toBeInstanceOf(RiskRejectedError);
    expect(t.alpaca.placeOrder).not.toHaveBeenCalled();
    expect(await t.findOrder('ord-risk')).toMatchObject({
      status: 'risk_rejected',
      error: 'daily loss limit reached',
    });
  });

  it('marks orders Alpaca rejected as submit_failed', async () => {
    t.alpaca.placeOrder.mockRejectedValue(
      new Error('insufficient buying power'),
    );

    await expect(
      t.ordersService.placeOrder(marketBuy('ord-2')),
    ).rejects.toThrow('insufficient buying power');
    expect(await t.findOrder('ord-2')).toMatchObject({
      status: 'submit_failed',
      error: 'insufficient buying power',
    });
  });

  it('marks orders lost to a network failure as unknown', async () => {
    t.alpaca.placeOrder.mockRejectedValue(fetchError('socket hang up'));

    await expect(
      t.ordersService.placeOrder(marketBuy('ord-3')),
    ).rejects.toThrow('socket hang up');
    expect(await t.findOrder('ord-3')).toMatchObject({ status: 'unknown' });
  });
});
