import type { AlpacaService } from '../alpaca/alpaca.service.js';
import type { OrdersService } from '../orders/orders.service.js';
import type { DeploymentsService } from '../paper/deployments.service.js';
import { reconcileLedger } from '../paper/reconcile.js';
import { emptyLedger } from '../paper/sleeve-ledger.js';
import type { AssetsService } from './assets.service.js';
import type { MyStocks, MyStocksStore } from './my-stocks.store.js';
import { MyStocksService } from './my-stocks.service.js';

function setup(
  opts: { paper?: boolean; free?: number; fractionable?: boolean } = {},
) {
  let doc: MyStocks = {
    key: 'paper',
    ledger: emptyLedger(0),
    levels: {},
    watchlist: [],
    events: [],
  };
  const store = {
    get: async () => structuredClone(doc),
    update: async <T>(f: (m: MyStocks) => T) => {
      const m = structuredClone(doc);
      const out = await f(m);
      doc = m;
      return out;
    },
  } as unknown as MyStocksStore;
  const placeOrder = vi.fn(async () => ({}));
  const service = new MyStocksService(
    store,
    {
      isPaper: opts.paper ?? true,
      getLatestTrades: async (s: string[]) => ({
        [s[0]]: { price: 100, at: new Date() },
      }),
    } as unknown as AlpacaService,
    { placeOrder } as unknown as OrdersService,
    {
      find: async (s: string) =>
        s === 'NOPE'
          ? null
          : {
              symbol: s,
              name: s,
              exchange: '',
              tradable: true,
              fractionable: opts.fractionable ?? true,
            },
    } as unknown as AssetsService,
    {
      freeCash: async () => opts.free ?? 1000,
    } as unknown as DeploymentsService,
  );
  return { service, placeOrder, doc: () => doc };
}

describe('MyStocksService', () => {
  it('buys a dollar amount and keeps it pending until it fills', async () => {
    const s = setup();
    await s.service.buy('AAPL', 250);
    expect(s.placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'AAPL',
        side: 'buy',
        notional: 250,
        type: 'market',
      }),
    );
    const [p] = s.doc().ledger.pending;
    expect(p).toMatchObject({
      symbol: 'AAPL',
      side: 'buy',
      notional: 250,
      qty: 2.5,
    });
    expect(p.clientOrderId).toMatch(/^man-AAPL-/);

    // The fill is booked into your own ledger (the same booking the investments use).
    const ledger = s.doc().ledger;
    await reconcileLedger(
      ledger,
      async () => ({ status: 'filled', filledQty: 2.5, filledAvgPrice: 100 }),
      new Date(),
    );
    expect(ledger.positions.AAPL).toMatchObject({ qty: 2.5, avgPrice: 100 });
    expect(ledger.pending).toEqual([]);
  });

  it('refuses more than the free cash, an unknown stock, and the live account', async () => {
    await expect(setup({ free: 100 }).service.buy('AAPL', 250)).rejects.toThrow(
      /Only \$100.00 is free/,
    );
    await expect(setup().service.buy('NOPE', 50)).rejects.toThrow(
      /can't be traded/,
    );
    await expect(
      setup({ paper: false }).service.buy('AAPL', 50),
    ).rejects.toThrow(/paper account only/);
  });

  it('sells only your own shares, at most what you hold, one sell at a time', async () => {
    const s = setup();
    await expect(s.service.sell('AAPL')).rejects.toThrow(/don't hold/);
    await s.service.buy('AAPL', 300);
    await reconcileLedger(
      s.doc().ledger,
      async () => ({ status: 'filled', filledQty: 3, filledAvgPrice: 100 }),
      new Date(),
    );
    await s.service.sell('AAPL', 10_000);
    expect(s.placeOrder).toHaveBeenLastCalledWith(
      expect.objectContaining({ symbol: 'AAPL', side: 'sell', qty: 3 }),
    );
    await expect(s.service.sell('AAPL')).rejects.toThrow(/already waiting/);
  });
});
