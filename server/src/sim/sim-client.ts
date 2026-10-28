import type { Alpaca, trading } from '@alpacahq/alpaca-trade-api';
import type { AlpacaAccounts } from '../accounts/alpaca-accounts.service.js';
import { SimError } from './sim-fills.js';
import type { SimLedger } from './sim-ledger.service.js';
import type { SimMarket } from './sim-market.service.js';
import { accountView, orderView, positionView } from './sim-views.js';

type Trading = Alpaca['trading'];
type ListInput = Parameters<Trading['orders']['getAllOrders']>[0];

const num = (v: unknown) =>
  v === undefined || v === null ? undefined : Number(v);

/**
 * A Bullwether paper account as an Alpaca SDK client: the trading calls the
 * app makes (account, positions, orders, activities) go to the paper books;
 * the clock, stock details and market data come from the app's real Alpaca
 * client. Anything else isn't available on a paper account.
 */
export function simClient(
  id: string,
  ledger: SimLedger,
  market: SimMarket,
  accounts: AlpacaAccounts,
): Alpaca {
  const real = () => accounts.dataClient();

  const getAccount = async () => {
    const [a, waiting] = await Promise.all([
      ledger.account(id),
      ledger.waiting(id),
    ]);
    const quotes = await market.quotes(a.positions.map((p) => p.symbol));
    return accountView(
      a,
      quotes,
      waiting.reduce((s, w) => s + w.reserved, 0),
    );
  };

  const positions = async () => {
    const [a, waiting] = await Promise.all([
      ledger.account(id),
      ledger.waiting(id),
    ]);
    const quotes = await market.quotes(a.positions.map((p) => p.symbol));
    return a.positions.map((p) =>
      positionView(
        p,
        quotes.get(p.symbol),
        waiting
          .filter((w) => w.side === 'sell' && w.symbol === p.symbol)
          .reduce((s, w) => s + (w.qty ?? 0), 0),
      ),
    );
  };

  const position = async (symbol: string) => {
    const p = (await positions()).find(
      (x) => x.symbol === symbol.toUpperCase(),
    );
    if (!p) throw new SimError('NotFoundError', 404, 'position does not exist');
    return p;
  };

  /** Sells all of a holding that isn't already being sold. */
  const sellAll = async (symbol: string) => {
    const p = await position(symbol);
    return orderView(
      await ledger.submit(id, {
        symbol: p.symbol,
        side: 'sell',
        type: 'market',
        timeInForce: 'day',
        qty: Number(p.qtyAvailable),
      }),
    );
  };

  const cancelAll = async () => {
    const waiting = await ledger.waiting(id);
    for (const o of waiting)
      await ledger.cancel(id, o._id).catch(() => undefined);
    return waiting.map(
      (o) => ({ id: o._id, status: 200 }) as trading.CanceledOrderResponse,
    );
  };

  const listOrders = async (input: ListInput = {}) => {
    const status = input.status ?? 'open';
    const q: Record<string, unknown> = { accountId: id };
    if (status === 'open') q.status = 'accepted';
    if (status === 'closed') q.status = { $ne: 'accepted' };
    if (input.side) q.side = input.side;
    if (input.symbols) q.symbol = { $in: String(input.symbols).split(',') };
    const at: Record<string, Date> = {};
    if (input.after) at.$gt = new Date(String(input.after));
    if (input.until) at.$lt = new Date(String(input.until));
    if (Object.keys(at).length) q.submittedAt = at;
    const docs = await ledger.orders
      .find(q)
      .sort({ submittedAt: input.direction === 'asc' ? 1 : -1 })
      .limit(Math.min(Number(input.limit ?? 50), 500))
      .lean();
    return docs.map(orderView);
  };

  const byQuery = async (q: Record<string, string>) => {
    const doc = await ledger.orders.findOne({ accountId: id, ...q }).lean();
    if (!doc) throw new SimError('NotFoundError', 404, 'order not found');
    return orderView(doc);
  };

  const simTrading = {
    account: { getAccount },
    positions: {
      getAllOpenPositions: positions,
      getOpenPosition: (r: { symbolOrAssetId: string }) =>
        position(r.symbolOrAssetId),
      deleteOpenPosition: (r: { symbolOrAssetId: string }) =>
        sellAll(r.symbolOrAssetId),
    },
    orders: {
      submit: async (o: Parameters<Trading['orders']['submit']>[0]) =>
        orderView(
          await ledger.submit(id, {
            symbol: String(o.symbol ?? '').toUpperCase(),
            side: o.side === 'sell' ? 'sell' : 'buy',
            type: String(o.type),
            timeInForce: String(o.timeInForce ?? 'day'),
            qty: num(o.qty),
            notional: num(o.notional),
            clientOrderId: o.clientOrderId,
          }),
        ),
      getAllOrders: listOrders,
      getOrderByOrderID: (r: { orderId: string }) =>
        byQuery({ _id: r.orderId }),
      getOrderByClientOrderId: (r: { clientOrderId: string }) =>
        byQuery({ clientOrderId: r.clientOrderId }),
      deleteOrderByOrderID: (r: { orderId: string }) =>
        ledger.cancel(id, r.orderId),
      deleteAllOrders: cancelAll,
    },
    closeAllPositions: async (r?: { cancelOrders?: boolean }) => {
      if (r?.cancelOrders) await cancelAll();
      const out: trading.PositionClosedReponse[] = [];
      for (const p of await positions())
        out.push({
          symbol: p.symbol,
          status: 200,
          body: await sellAll(p.symbol),
        });
      return out;
    },
    accountActivities: {
      getAccountActivitiesRaw: async (r: {
        direction?: string;
        pageSize?: number;
        after?: Date;
        pageToken?: string;
      }) => {
        const q: Record<string, unknown> = { accountId: id };
        if (r.after) q.at = { $gt: r.after };
        if (r.pageToken)
          q._id = { [r.direction === 'desc' ? '$lt' : '$gt']: r.pageToken };
        const docs = await ledger.activities
          .find(q)
          .sort({ _id: r.direction === 'desc' ? -1 : 1 })
          .limit(r.pageSize ?? 100)
          .lean();
        const rows = docs.map((d) => ({ id: d._id, ...d.row }));
        return { raw: new Response(JSON.stringify(rows)) };
      },
    },
    validateConnection: async () => ({
      ok: true as const,
      account: await getAccount(),
    }),
    get clock() {
      return real().trading.clock;
    },
    get assets() {
      return real().trading.assets;
    },
  };

  const tradingProxy = new Proxy(simTrading, {
    get(target, key, receiver) {
      if (key in target) return Reflect.get(target, key, receiver) as unknown;
      if (typeof key === 'symbol' || key === 'then') return undefined;
      throw new SimError(
        'ForbiddenError',
        403,
        `${key} is not available on a Bullwether paper account`,
      );
    },
  });

  return {
    paper: true,
    trading: tradingProxy,
    get marketData() {
      return real().marketData;
    },
    get data() {
      return real().data;
    },
  } as unknown as Alpaca;
}
