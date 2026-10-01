import type { CycleDeps } from './deployment-events.js';
import type { Runtime } from './deployment-runtime.js';
import type { Deployment } from './deployment.types.js';
import { dropHeldOffBuys, manualExits, mayBuy } from './manual-exits.js';
import type { DeploymentRunnerService } from './deployment-runner.service.js';
import type { DeploymentStore } from './deployment-store.js';
import { PositionActionsService } from './position-actions.service.js';
import { SleeveContext } from './sleeve-context.js';
import { emptyLedger } from './sleeve-ledger.js';

const now = new Date('2026-10-02T21:00:00Z');
function deployment(): Deployment {
  const l = emptyLedger(1_000);
  l.positions = {
    NVDA: { symbol: 'NVDA', qty: 0.5, avgPrice: 200 },
    MRK: { symbol: 'MRK', qty: 2, avgPrice: 100 },
  };
  l.lastPrices = { NVDA: 179, MRK: 131 };
  return {
    id: 'd1',
    status: 'active',
    ledgers: [l],
    events: [],
    sleeves: [{ params: {} }],
  } as unknown as Deployment;
}
const runtime = (d: Deployment): Runtime => ({
  warmed: true,
  sleeves: [
    { strategy: {} as never, context: new SleeveContext(d.ledgers[0]) },
  ],
});
const deps = () => {
  const placeOrder = vi.fn(async () => undefined);
  return { deps: { placeOrder } as unknown as CycleDeps, placeOrder };
};

describe('your own levels', () => {
  it('sells on a close past your stop or target, drops the strategy orders for it, and holds off', async () => {
    const d = deployment();
    d.manual = { NVDA: { stopPrice: 180 }, MRK: { takeProfitPrice: 130 } };
    const rt = runtime(d);
    rt.sleeves[0].context.orders.push({
      symbol: 'NVDA',
      side: 'buy',
      qty: 0.1,
      reason: 'rebalance',
    });
    const { deps: cycleDeps, placeOrder } = deps();
    await manualExits(d, rt, cycleDeps, now);
    expect(
      placeOrder.mock.calls.map(([o]) => [
        (o as { symbol: string }).symbol,
        (o as { qty: number }).qty,
      ]),
    ).toEqual([
      ['NVDA', 0.5],
      ['MRK', 2],
    ]);
    expect(d.ledgers[0].pending.map((p) => p.reason)).toEqual([
      'your stop loss ($180.00): closed at $179.00',
      'your profit target ($130.00): closed at $131.00',
    ]);
    expect(rt.sleeves[0].context.orders).toEqual([]);
    expect(d.manual).toEqual({});
    expect(mayBuy(d, 'NVDA', now)).toBe(false);
    expect(mayBuy(d, 'NVDA', new Date(now.getTime() + 31 * 86_400_000))).toBe(
      true,
    );
  });

  it('does not buy a stock you sold until its hold-off ends', () => {
    const d = deployment();
    d.noBuyUntil = { AMD: new Date(now.getTime() + 86_400_000) };
    const rt = runtime(d);
    rt.sleeves[0].context.orders.push(
      { symbol: 'AMD', side: 'buy', qty: 1 },
      { symbol: 'CAT', side: 'buy', qty: 1 },
    );
    dropHeldOffBuys(d, rt, now);
    expect(rt.sleeves[0].context.orders.map((o) => o.symbol)).toEqual(['CAT']);
    expect(d.events[0].message).toMatch(/^Did not buy AMD: you sold it/);
  });
});

describe('PositionActionsService', () => {
  const setup = () => {
    const d = deployment();
    const save = vi.fn(async () => undefined);
    const placeNow = vi.fn(
      async (
        dep: Deployment,
        i: number,
        o: { symbol: string; side: 'sell'; qty: number; reason?: string },
      ) => {
        dep.ledgers[i].pending.push({
          ...o,
          clientOrderId: 'x',
          submittedAt: now,
          bookedQty: 0,
        });
      },
    );
    const service = new PositionActionsService(
      { get: async () => d, save } as unknown as DeploymentStore,
      { placeNow } as unknown as DeploymentRunnerService,
    );
    return { d, service, placeNow, save };
  };

  it('sells all (and holds off) or half', async () => {
    const { d, service, placeNow } = setup();
    await service.sell('d1', 'nvda', 0.5);
    expect(placeNow.mock.calls[0][2]).toMatchObject({
      symbol: 'NVDA',
      qty: 0.25,
      reason: 'sold 50% by you',
    });
    expect(d.noBuyUntil?.NVDA).toBeUndefined();
    await expect(service.sell('d1', 'NVDA', 1)).rejects.toThrow(
      /already waiting/,
    );
    await service.sell('d1', 'MRK', 1);
    expect(placeNow.mock.calls[1][2]).toMatchObject({
      symbol: 'MRK',
      qty: 2,
      reason: 'sold by you',
    });
    expect(d.noBuyUntil?.MRK).toBeInstanceOf(Date);
    await expect(service.sell('d1', 'AAPL', 1)).rejects.toThrow(
      /does not hold AAPL/,
    );
  });

  it('checks your levels against the latest close, and clears them with null', async () => {
    const { d, service } = setup();
    await expect(
      service.setLevels('d1', 'MRK', { stopPrice: 140 }),
    ).rejects.toThrow(/below the latest close \(\$131.00\)/);
    await expect(
      service.setLevels('d1', 'MRK', { takeProfitPrice: 120 }),
    ).rejects.toThrow(/above the latest close/);
    await service.setLevels('d1', 'MRK', {
      stopPrice: 125,
      takeProfitPrice: 150,
    });
    expect(d.manual?.MRK).toEqual({ stopPrice: 125, takeProfitPrice: 150 });
    await service.setLevels('d1', 'MRK', {
      stopPrice: null,
      takeProfitPrice: null,
    });
    expect(d.manual?.MRK).toBeUndefined();
  });
});
