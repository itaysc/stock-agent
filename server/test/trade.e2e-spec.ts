import {
  createMockAlpaca,
  type MockRequest,
} from '@alpacahq/alpaca-trade-api/testing';
import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AccountContext } from '../src/accounts/account-context.js';
import { AlpacaAccounts } from '../src/accounts/alpaca-accounts.service.js';
import { ALPACA_CLIENT } from '../src/alpaca/alpaca.constants.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { MyStocksDoc } from '../src/trade/my-stocks.store.js';
import { MyStocksRunner } from '../src/trade/my-stocks-runner.service.js';
import { addTestAccount, forgetAccounts } from './support/test-account.js';

/** 300 rising daily bars. */
const barsFor = (symbol: string, step: number) =>
  Array.from({ length: 300 }, (_, i) => {
    const c = 100 * (1 + step) ** i;
    return {
      t: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString(),
      o: c,
      h: c,
      l: c,
      c,
      v: 1000,
      S: symbol,
    };
  });

describe('Trade API (e2e)', () => {
  let app: INestApplication<App>;
  const sent: Array<Record<string, unknown>> = [];
  let filled = 0;

  beforeAll(async () => {
    // The Bank of Israel's dollar rates (no real request from tests): 3.5 every day of the last weeks.
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
    const alpaca = createMockAlpaca([
      {
        path: '/v2/account',
        body: {
          id: 'acc-1',
          status: 'ACTIVE',
          cash: '1000',
          equity: '1000',
          last_equity: '1000',
          account_number: 'PA1',
        },
      },
      {
        path: '/v2/positions',
        respond: () =>
          filled
            ? [
                {
                  asset_id: '1',
                  symbol: 'AAPL',
                  exchange: 'NASDAQ',
                  asset_class: 'us_equity',
                  qty: String(filled),
                  side: 'long',
                  avg_entry_price: '200',
                  market_value: String(filled * 200),
                  current_price: '200',
                },
              ]
            : [],
      },
      {
        path: '/v2/assets',
        body: [
          {
            id: '1',
            class: 'us_equity',
            exchange: 'NASDAQ',
            symbol: 'AAPL',
            name: 'Apple Inc. Common Stock',
            status: 'active',
            tradable: true,
            fractionable: true,
          },
          {
            id: '2',
            class: 'us_equity',
            exchange: 'NYSE',
            symbol: 'NVR',
            name: 'NVR Inc.',
            status: 'active',
            tradable: true,
            fractionable: false,
          },
        ],
      },
      {
        path: '/v2/stocks/trades/latest',
        respond: ({ url }: MockRequest) => ({
          trades: Object.fromEntries(
            (url.searchParams.get('symbols') ?? '')
              .split(',')
              .map((s) => [
                s,
                { p: s === 'NVR' ? 7000 : 200, t: new Date().toISOString() },
              ]),
          ),
        }),
      },
      {
        method: 'POST',
        path: '/v2/orders',
        respond: (req: MockRequest) => {
          const body = JSON.parse(req.init?.body as string) as Record<
            string,
            unknown
          >;
          sent.push(body);
          return {
            id: `o${sent.length}`,
            client_order_id: body.client_order_id,
            status: 'accepted',
            symbol: body.symbol,
          };
        },
      },
      {
        path: '/v2/orders:by_client_order_id',
        respond: ({ url }: MockRequest) => ({
          id: 'o1',
          client_order_id: url.searchParams.get('client_order_id'),
          status: filled ? 'filled' : 'accepted',
          filled_qty: String(filled),
          filled_avg_price: filled ? '200' : null,
        }),
      },
      {
        path: '/v2/stocks/bars',
        respond: ({ url }: MockRequest) => ({
          bars: Object.fromEntries(
            (url.searchParams.get('symbols') ?? '')
              .split(',')
              .map((s) => [s, barsFor(s, s === 'XOM' ? -0.001 : 0.002)]),
          ),
          next_page_token: null,
        }),
      },
    ]);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ALPACA_CLIENT)
      .useValue(alpaca)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await forgetAccounts(app);
    await app.init();
    await addTestAccount(app);
    await app
      .get<Model<MyStocksDoc>>(getModelToken(MyStocksDoc.name))
      .deleteMany({});
  });

  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());

  it('finds a stock by ticker or company name', async () => {
    const res = await http().get('/api/v1/trade/search?q=apple').expect(200);
    expect(res.body[0]).toMatchObject({ symbol: 'AAPL', fractionable: true });
  });

  it('buys a dollar amount, books the fill, and sells only your shares', async () => {
    await http()
      .post('/api/v1/trade/buy')
      .send({ symbol: 'AAPL', amount: 2000 })
      .expect(400); // only $1,000 free
    await http()
      .post('/api/v1/trade/buy')
      .send({ symbol: 'NVR', amount: 500 })
      .expect(400); // whole shares only
    const buy = await http()
      .post('/api/v1/trade/buy')
      .send({ symbol: 'AAPL', amount: 400 })
      .expect(200);
    expect(sent.at(-1)).toMatchObject({
      symbol: 'AAPL',
      side: 'buy',
      notional: '400',
    });
    expect(buy.body.pending).toHaveLength(1);

    filled = 2;
    await AccountContext.run(app.get(AlpacaAccounts).first()!, () =>
      app.get(MyStocksRunner).bookFills(),
    );
    const mine = await http().get('/api/v1/trade/my-stocks').expect(200);
    expect(mine.body.positions[0]).toMatchObject({
      symbol: 'AAPL',
      qty: 2,
      avgPrice: 200,
      paidUsd: 400,
      paidIls: 1400, // $400 at 3.5
    });
    expect(mine.body.pending).toHaveLength(0);

    const sell = await http()
      .post('/api/v1/trade/sell')
      .send({ symbol: 'AAPL', amount: 99_999 });
    expect(sell.status).toBe(200);
    expect(sent.at(-1)).toMatchObject({
      symbol: 'AAPL',
      side: 'sell',
      qty: '2',
    });
  });

  it('ranks a category by trend, rising ones first', async () => {
    const res = await http()
      .get('/api/v1/trade/discover?category=oil')
      .expect(200);
    expect(res.body.items.at(-1)).toMatchObject({
      symbol: 'XOM',
      aboveTrend: false,
    });
    expect(res.body.note).toMatch(/not advice/);
  });
});
