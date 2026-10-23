import { candidatesFor } from '../broker/broker-slots.service.js';
import type { NotifierService } from '../notify/notifier.service.js';
import type { DeploymentRunnerService } from './deployment-runner.service.js';
import type { DeploymentStore } from './deployment-store.js';
import type { Deployment } from './deployment.types.js';
import { PositionActionsService } from './position-actions.service.js';
import { SlotActionsService } from './slot-actions.service.js';
import { emptyLedger } from './sleeve-ledger.js';

function setup(newsCheck = true) {
  const ledger = {
    ...emptyLedger(0),
    positions: { AMAT: { symbol: 'AMAT', qty: 1, avgPrice: 500 } },
    lastPrices: { AMAT: 450, LLY: 900, XOM: 120 },
  };
  let d = {
    id: 'd1',
    name: 'Broker',
    status: 'active',
    capital: 1000,
    events: [],
    sleeves: [
      {
        symbols: ['AMAT', 'LLY', 'XOM', 'BIL'],
        params: { topN: '5', fractional: '1' },
      },
    ],
    ledgers: [ledger],
    newsCheck: newsCheck ? { tone: 0.3, ai: true, watch: 'alert' } : undefined,
  } as unknown as Deployment;
  const store = {
    get: async () => structuredClone(d),
    save: async (x: Deployment) => {
      d = structuredClone(x);
    },
  } as unknown as DeploymentStore;
  const placeNow = vi.fn(
    async (
      x: Deployment,
      i: number,
      o: { symbol: string; side: string; qty: number },
    ) => {
      x.ledgers[i].pending.push({
        clientOrderId: `c-${o.symbol}`,
        ...o,
        submittedAt: new Date(),
        bookedQty: 0,
      } as never);
    },
  );
  const runner = { placeNow } as unknown as DeploymentRunnerService;
  const notify = vi.fn(async () => undefined);
  const positions = new PositionActionsService(store, runner);
  const slots = new SlotActionsService(store, runner, positions, {
    send: notify,
  } as unknown as NotifierService);
  return { slots, placeNow, notify, d: () => d };
}

describe('selling one stock and its place', () => {
  it('replace: sells it and stages a buy of the chosen stock for about the same money', async () => {
    const s = setup();
    await s.slots.sellOne('d1', 'AMAT', 'LLY');
    expect(s.placeNow).toHaveBeenCalledWith(
      expect.anything(),
      0,
      expect.objectContaining({ symbol: 'AMAT', side: 'sell', qty: 1 }),
      expect.any(String),
    );
    const l = s.d().ledgers[0];
    expect(l.staged?.[0]).toMatchObject({ symbol: 'LLY', qty: 0.5 }); // $450 / $900
    expect(l.emptySlots ?? 0).toBe(0);
    expect(s.d().soldByYou?.AMAT).toBeDefined();
  });

  it('just sell: the place stays empty and you get a nudge; filling it later buys an equal share', async () => {
    const s = setup(false);
    await s.slots.sellOne('d1', 'AMAT');
    expect(s.d().ledgers[0].emptySlots).toBe(1);
    expect(s.notify).toHaveBeenCalledWith(
      expect.stringMatching(/place is empty/),
    );
    // Its sell hasn't filled yet (and you sold it): not a candidate.
    await expect(s.slots.fillSlot('d1', 'AMAT')).rejects.toThrow(
      /already holds AMAT/,
    );
    await s.slots.fillSlot('d1', 'XOM');
    expect(s.placeNow).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      expect.objectContaining({ symbol: 'XOM', side: 'buy' }),
      'you chose it',
    );
    expect(s.d().ledgers[0].emptySlots).toBe(0);
  });

  it('refuses a replacement that is not one of its stocks or already held', async () => {
    const s = setup();
    await expect(s.slots.sellOne('d1', 'AMAT', 'TSLA')).rejects.toThrow(
      /not one of this investment's stocks/,
    );
    await expect(s.slots.sellOne('d1', 'AMAT', 'AMAT')).rejects.toThrow(
      /already holds/,
    );
  });
});

it('next in line: the best-ranked stocks it can buy (not held, not sold by you)', () => {
  const d = {
    ledgers: [
      {
        ...emptyLedger(0),
        positions: { A: { symbol: 'A', qty: 1, avgPrice: 1 } },
      },
    ],
    soldByYou: { B: new Date(Date.now() + 86_400_000) },
  } as unknown as Deployment;
  const closes = () => Array.from({ length: 300 }, (_, i) => 100 + i);
  const out = candidatesFor(
    d,
    ['A', 'B', 'C', 'BIL', 'D', 'E'],
    closes,
    new Date(),
    2,
  );
  expect(out.map((x) => [x.symbol, x.rank])).toEqual([
    ['C', 3],
    ['D', 5],
  ]);
});
