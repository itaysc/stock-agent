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
      throw new Error('insufficient buying power');
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
    expect(d.events[0].message).toMatch(/not sent: insufficient buying power/);
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
