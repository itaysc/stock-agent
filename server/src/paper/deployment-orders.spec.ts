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
