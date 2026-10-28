import {
  createMockAlpaca,
  type MockRequest,
} from '@alpacahq/alpaca-trade-api/testing';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';

// The login on: the admin (whose Alpaca key gives the prices) and invited users.
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('admin-password', 4);
process.env.JWT_SECRET = 's'.repeat(40);

let open = true;
let price = 200;
const now = () => new Date().toISOString();
const trade = (p: number) => ({
  t: now(),
  x: 'V',
  p,
  s: 1,
  c: ['@'],
  i: 1,
  z: 'C',
});
const bar = (c: number) => ({
  t: now(),
  o: c,
  h: c,
  l: c,
  c,
  v: 1,
  n: 1,
  vw: c,
});
const asset = (symbol: string, fractionable: boolean) => ({
  id: symbol,
  class: 'us_equity',
  exchange: 'NASDAQ',
  symbol,
  name: symbol,
  status: 'active',
  tradable: true,
  marginable: true,
  shortable: true,
  fractionable,
});
const symbolsOf = (req: MockRequest) =>
  (req.url.searchParams.get('symbols') ?? '').split(',');

/** The admin's Alpaca account: prices, stock details and the clock for everyone. */
const alpaca = createMockAlpaca([
  {
    path: '/v2/account',
    body: { id: 'acc-1', account_number: 'PA1', status: 'ACTIVE', cash: '0' },
  },
  { path: '/v2/positions', body: [] },
  { path: '/v2/orders', body: [] },
  {
    path: '/v2/clock',
    respond: () => ({
      is_open: open,
      timestamp: now(),
      next_open: now(),
      next_close: now(),
    }),
  },
  { path: '/v2/assets', body: [asset('AAPL', true), asset('NVR', false)] },
  {
    path: /^\/v2\/assets\/\w+$/,
    respond: (req: MockRequest) =>
      asset(
        req.url.pathname.split('/').at(-1)!,
        !req.url.pathname.endsWith('NVR'),
      ),
  },
  {
    path: '/v2/stocks/snapshots',
    respond: (req: MockRequest) =>
      Object.fromEntries(
        symbolsOf(req).map((s) => [
          s,
          {
            latestTrade: trade(price),
            dailyBar: bar(price),
            prevDailyBar: bar(190),
          },
        ]),
      ),
  },
  {
    path: '/v2/stocks/trades/latest',
    respond: (req: MockRequest) => ({
      trades: Object.fromEntries(symbolsOf(req).map((s) => [s, trade(price)])),
    }),
  },
  {
    path: '/v2/stocks/bars',
    respond: (req: MockRequest) => ({
      bars: Object.fromEntries(
        symbolsOf(req).map((s) => [s, [{ ...bar(190), S: s }]]),
      ),
      next_page_token: null,
    }),
  },
  {
    path: '/v1/corporate-actions',
    body: {
      corporate_actions: {
        forward_splits: [
          {
            id: 'split-1',
            symbol: 'AAPL',
            cusip: '1',
            old_rate: 1,
            new_rate: 2,
            ex_date: '2020-01-02',
            process_date: '2020-01-02',
          },
        ],
        cash_dividends: [
          {
            id: 'div-1',
            symbol: 'AAPL',
            cusip: '1',
            rate: 0.5,
            foreign: false,
            special: false,
            ex_date: '2020-01-02',
            process_date: '2020-01-02',
          },
        ],
      },
      next_page_token: null,
    },
  },
]);

describe('Bullwether paper accounts (e2e)', () => {
  let app: INestApplication<App>;
  let db: Connection;

  beforeAll(async () => {
    // The Bank of Israel's dollar rate (no real request from tests): 3.5.
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const href = url instanceof Request ? url.url : url.toString();
      if (!href.includes('boi.gov.il')) return realFetch(url, init);
      const days = Array.from({ length: 20 }, (_, i) =>
        new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      );
      return Promise.resolve(
        new Response(
          `TIME_PERIOD,OBS_VALUE\n${days.map((d) => `${d},3.5`).join('\n')}`,
        ),
      );
    });
    const { ALPACA_CLIENT } = await import('../src/alpaca/alpaca.constants.js');
    const { AppModule } = await import('../src/app.module.js');
    const { setupApp } = await import('../src/app.setup.js');
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ALPACA_CLIENT)
      .useValue(alpaca)
      .compile();
    app = ref.createNestApplication({ bufferLogs: true });
    setupApp(app);
    db = app.get(getConnectionToken());
    await Promise.all(
      [
        'users',
        'invites',
        'alpaca_accounts',
        'sim_accounts',
        'sim_orders',
        'sim_activities',
        'my_stocks',
      ].map((c) => db.collection(c).deleteMany({})),
    );
    await app.init();
  });
  afterAll(() => app.close());

  const agent = () => request.agent(app.getHttpServer());
  let admin: ReturnType<typeof agent>;
  let dana: ReturnType<typeof agent>;
  let paperId = '';

  /** The paper account as the app sees it (the SDK's account call). */
  const account = async (id = paperId) => {
    const { AlpacaAccounts } =
      await import('../src/accounts/alpaca-accounts.service.js');
    return app.get(AlpacaAccounts).get(id)!.client.trading.account.getAccount();
  };
  const book = async () => {
    const { AlpacaAccounts } =
      await import('../src/accounts/alpaca-accounts.service.js');
    const { AccountContext } =
      await import('../src/accounts/account-context.js');
    const { MyStocksRunner } =
      await import('../src/trade/my-stocks-runner.service.js');
    await AccountContext.run(app.get(AlpacaAccounts).get(paperId)!, () =>
      app.get(MyStocksRunner).bookFills(),
    );
  };

  it('opens a paper account with $100,000 for a new user', async () => {
    admin = agent();
    await admin
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'admin-password' })
      .expect(200);
    await admin
      .post('/api/v1/accounts')
      .send({ name: 'Admin', keyId: 'PKADMIN0001', secret: 'admin-secret' })
      .expect(200);
    const invite = await admin
      .post('/api/v1/users/invites')
      .send({ note: 'A friend' })
      .expect(200);
    dana = agent();
    await dana
      .post('/api/v1/auth/signup')
      .send({
        token: invite.body.token,
        email: 'dana@example.com',
        password: 'dana-password-1',
        acceptTerms: true,
      })
      .expect(200);
    await vi.waitFor(async () => {
      const list = await dana.get('/api/v1/accounts').expect(200);
      expect(list.body.accounts).toMatchObject([
        {
          auth: 'sim',
          paper: true,
          keyHint: 'Bullwether',
          name: 'Bullwether paper',
        },
      ]);
      expect(list.body.canOpenPaper).toBe(false);
      paperId = list.body.accounts[0].id;
    });
    expect(paperId).toMatch(/^BW[A-Z2-9]{8}$/);
    expect(await account()).toMatchObject({
      cash: '100000',
      equity: '100000',
      buyingPower: '100000',
    });
    // One each.
    await dana.post('/api/v1/accounts/paper').expect(409);
  });

  it('buys at the latest price while the market is open', async () => {
    await dana
      .post('/api/v1/trade/buy')
      .send({ symbol: 'NVR', amount: 50 })
      .expect(400); // whole shares only
    await dana
      .post('/api/v1/trade/buy')
      .send({ symbol: 'AAPL', amount: 200_000 })
      .expect(400);
    await dana
      .post('/api/v1/trade/buy')
      .send({ symbol: 'AAPL', amount: 400 })
      .expect(200);
    await book();
    const mine = await dana.get('/api/v1/trade/my-stocks').expect(200);
    expect(mine.body.positions[0]).toMatchObject({
      symbol: 'AAPL',
      qty: 2,
      avgPrice: 200,
    });
    expect(await account()).toMatchObject({ cash: '99600', equity: '100000' });
  });

  it('waits while the market is closed, holding the cash, and fills at the open', async () => {
    open = false;
    const { SimMarket } = await import('../src/sim/sim-market.service.js');
    // Forget the cached clock (it's checked every 30 s).
    (app.get(SimMarket) as unknown as { clock?: unknown }).clock = undefined;
    await dana
      .post('/api/v1/trade/buy')
      .send({ symbol: 'AAPL', amount: 200 })
      .expect(200);
    expect(await account()).toMatchObject({
      cash: '99600',
      buyingPower: '99400',
    });
    open = true;
    price = 250;
    (app.get(SimMarket) as unknown as { clock?: unknown }).clock = undefined;
    (
      app.get(SimMarket) as unknown as { quoteCache: Map<string, unknown> }
    ).quoteCache.clear();
    const { SimScheduler } =
      await import('../src/sim/sim-scheduler.service.js');
    expect(await app.get(SimScheduler).fillWaiting()).toBe(1);
    await book();
    // $200 at $250: 0.8 shares more.
    expect(await account()).toMatchObject({ cash: '99400', equity: '100100' });
  });

  it('applies splits and dividends after the close', async () => {
    const { SimScheduler } =
      await import('../src/sim/sim-scheduler.service.js');
    await app.get(SimScheduler).closeDay('2030-01-01');
    // 2.8 shares → 5.6; $0.50 a share on 5.6 shares.
    const a = await db
      .collection('sim_accounts')
      .findOne({ _id: paperId as never });
    expect(a).toMatchObject({
      cash: 99402.8,
      positions: [{ symbol: 'AAPL', qty: 5.6, costBasis: 600 }],
      appliedActions: ['split-1', 'div-1'],
    });
    await app.get(SimScheduler).closeDay('2030-01-02'); // applied once only
    expect(
      (await db.collection('sim_accounts').findOne({ _id: paperId as never }))
        ?.cash,
    ).toBe(99402.8);
  });

  it('sells, and keeps every fill and dividend for the tax records', async () => {
    const { AlpacaAccounts } =
      await import('../src/accounts/alpaca-accounts.service.js');
    const closed = await app
      .get(AlpacaAccounts)
      .get(paperId)!
      .client.trading.closeAllPositions({ cancelOrders: true });
    expect(closed).toMatchObject([{ symbol: 'AAPL', status: 200 }]);
    const a = await account();
    expect(a.longMarketValue).toBe('0');
    expect(Number(a.cash)).toBeCloseTo(99402.8 + 5.6 * 250, 2);
    const rows = await db
      .collection('sim_activities')
      .find({ accountId: paperId })
      .sort({ _id: 1 })
      .toArray();
    expect(
      rows.map((r) => (r.row as { activity_type: string }).activity_type),
    ).toEqual(['FILL', 'FILL', 'DIV', 'FILL']);
  });

  it('resets to a fresh account, only for its owner', async () => {
    const eve = agent();
    const invite = await admin
      .post('/api/v1/users/invites')
      .send({ note: 'A friend' })
      .expect(200);
    await eve
      .post('/api/v1/auth/signup')
      .send({
        token: invite.body.token,
        email: 'eve@example.com',
        password: 'eve-password-1',
        acceptTerms: true,
      })
      .expect(200);
    await eve.post(`/api/v1/accounts/${paperId}/reset`).expect(404);
    const res = await dana
      .post(`/api/v1/accounts/${paperId}/reset`)
      .expect(200);
    expect(res.body).toMatchObject({ auth: 'sim', name: 'Bullwether paper' });
    expect(res.body.id).not.toBe(paperId);
    expect(
      await db.collection('sim_orders').countDocuments({ accountId: paperId }),
    ).toBe(0);
    paperId = res.body.id;
    expect(await account()).toMatchObject({
      cash: '100000',
      longMarketValue: '0',
    });
    const list = await dana.get('/api/v1/accounts').expect(200);
    expect(list.body.accounts.map((a: { id: string }) => a.id)).toEqual([
      paperId,
    ]);
    // Removed: its books go too, and another can open.
    await dana.delete(`/api/v1/accounts/${paperId}`).expect(204);
    expect(
      await db
        .collection('sim_accounts')
        .countDocuments({ _id: paperId as never }),
    ).toBe(0);
    expect(
      (await dana.get('/api/v1/accounts').expect(200)).body.canOpenPaper,
    ).toBe(true);
  });
});
