import type { CycleDeps } from './deployment-events.js';
import { placeOne } from './deployment-orders.js';
import type { Deployment } from './deployment.types.js';
import { emptyLedger } from './sleeve-ledger.js';

const deployment = () =>
  ({
    id: 'abcdef12-x',
    ledgers: [emptyLedger(1_000)],
    events: [],
  }) as unknown as Deployment;

describe('placeOne', () => {
  it('sends whole shares when the stock cannot be traded in fractions', async () => {
    const placeOrder = vi.fn(async (o: { qty: number }) => {
      if (!Number.isInteger(o.qty))
        throw new Error('asset BRK.B is not fractionable');
    });
    const d = deployment();
    await placeOne(
      d,
      0,
      { symbol: 'BRK.B', side: 'buy', qty: 2.5 },
      { placeOrder } as unknown as CycleDeps,
      new Date(),
    );
    expect(placeOrder.mock.calls.map(([o]) => o.qty)).toEqual([2.5, 2]);
    expect(d.ledgers[0].pending[0]).toMatchObject({
      qty: 2,
      clientOrderId: expect.stringMatching(/w$/),
    });
  });

  it('does not retry other refusals', async () => {
    const placeOrder = vi.fn(async () => {
      throw new Error('asset AAPL is not active');
    });
    const d = deployment();
    await placeOne(
      d,
      0,
      { symbol: 'AAPL', side: 'buy', qty: 2.5 },
      { placeOrder } as unknown as CycleDeps,
      new Date(),
    );
    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(d.ledgers[0].pending).toEqual([]);
    expect(d.events[0].message).toMatch(/not sent: asset AAPL is not active/);
  });
});

describe('placeOne with prices', () => {
  const priced = () => {
    const d = deployment();
    d.ledgers[0].lastPrices = { AAPL: 100, 'BRK.B': 400 };
    return d;
  };
  type Sent = { qty?: number; notional?: number; clientOrderId: string };

  it('sends a fractional buy as a dollar amount (a higher open cannot overspend)', async () => {
    const placeOrder = vi.fn(async (_o: Sent) => undefined);
    const d = priced();
    await placeOne(
      d,
      0,
      { symbol: 'AAPL', side: 'buy', qty: 0.4567 },
      { placeOrder } as unknown as CycleDeps,
      new Date(),
    );
    expect(placeOrder.mock.calls[0][0]).toMatchObject({ notional: 45.67 });
    expect(placeOrder.mock.calls[0][0].qty).toBeUndefined();
    expect(d.ledgers[0].pending[0]).toMatchObject({ notional: 45.67 });
    expect(d.events[0].message).toMatch(/^Sent buy \$45\.67 of AAPL/);
  });

  it('buys what the account can pay for when it is short of cash', async () => {
    const placeOrder = vi.fn(async (o: Sent) => {
      if ((o.notional ?? 0) > 120) throw new Error('insufficient buying power');
    });
    const d = priced();
    await placeOne(
      d,
      0,
      { symbol: 'AAPL', side: 'buy', qty: 2.5 },
      { placeOrder, cashToBuy: async () => 120 } as unknown as CycleDeps,
      new Date(),
    );
    expect(placeOrder.mock.calls.map(([o]) => o.notional)).toEqual([250, 120]);
    expect(d.ledgers[0].pending[0]).toMatchObject({
      notional: 120,
      qty: 1.2,
      clientOrderId: expect.stringMatching(/c$/),
    });
  });

  it('buys fewer whole shares when short of cash', async () => {
    const placeOrder = vi.fn(async (o: Sent) => {
      if ((o.qty ?? 0) > 2) throw new Error('insufficient buying power');
    });
    const d = priced();
    await placeOne(
      d,
      0,
      { symbol: 'AAPL', side: 'buy', qty: 3 },
      { placeOrder, cashToBuy: async () => 250 } as unknown as CycleDeps,
      new Date(),
    );
    expect(placeOrder.mock.calls.map(([o]) => o.qty)).toEqual([3, 2]);
    expect(d.ledgers[0].pending[0]).toMatchObject({ qty: 2 });
  });

  it('gives up when the account cannot pay even $1', async () => {
    const placeOrder = vi.fn(async () => {
      throw new Error('insufficient buying power');
    });
    const d = priced();
    await placeOne(
      d,
      0,
      { symbol: 'AAPL', side: 'buy', qty: 0.5 },
      { placeOrder, cashToBuy: async () => 0.5 } as unknown as CycleDeps,
      new Date(),
    );
    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(d.ledgers[0].pending).toEqual([]);
    expect(d.events[0].message).toMatch(/not sent: insufficient buying power/);
  });

  it('falls back to whole shares when a dollar amount is refused (not fractionable)', async () => {
    const placeOrder = vi.fn(async (o: Sent) => {
      if (o.notional !== undefined)
        throw new Error('asset BRK.B is not fractionable');
    });
    const d = priced();
    await placeOne(
      d,
      0,
      { symbol: 'BRK.B', side: 'buy', qty: 2.5 },
      { placeOrder } as unknown as CycleDeps,
      new Date(),
    );
    expect(placeOrder.mock.calls.map(([o]) => o.qty ?? o.notional)).toEqual([
      1000, 2,
    ]);
    expect(d.ledgers[0].pending[0]).toMatchObject({ qty: 2 });
  });
});

describe('wash-trade retry', () => {
  it('keeps an order Alpaca refused as a wash trade, and sends it once the opposite one is done', async () => {
    const { retryOrders } = await import('./deployment-orders.js');
    let refuse = true;
    const placeOrder = vi.fn(async () => {
      if (refuse)
        throw new Error('potential wash trade detected. use complex orders');
    });
    const deps = {
      placeOrder,
      opensSoon: async () => true,
    } as unknown as CycleDeps;
    const d = deployment();
    await placeOne(
      d,
      0,
      { symbol: 'NVDA', side: 'buy', qty: 0.5 },
      deps,
      new Date(),
    );
    expect(d.ledgers[0].pending).toEqual([]);
    expect(d.ledgers[0].retry).toEqual([
      { symbol: 'NVDA', side: 'buy', qty: 0.5 },
    ]);
    expect(d.events[0].message).toMatch(
      /waits: another investment has an opposite order open/,
    );
    await retryOrders(d, deps, new Date()); // still refused: keeps waiting
    expect(d.ledgers[0].retry).toHaveLength(1);
    refuse = false; // the other investment's order filled
    await retryOrders(d, deps, new Date());
    expect(d.ledgers[0].retry).toEqual([]);
    expect(d.ledgers[0].pending[0]).toMatchObject({ symbol: 'NVDA', qty: 0.5 });
  });
});
