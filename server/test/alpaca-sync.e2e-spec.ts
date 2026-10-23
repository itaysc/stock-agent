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
import { ALPACA_CLIENT } from '../src/alpaca/alpaca.constants.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { MyStocksDoc } from '../src/trade/my-stocks.store.js';
import { forgetAccounts } from './support/test-account.js';

/** What the Alpaca account holds: 3 MSFT bought before the app knew it (changed by the tests). */
let msft = 3;
const position = () => ({
  asset_id: '9',
  symbol: 'MSFT',
  exchange: 'NASDAQ',
  asset_class: 'us_equity',
  qty: String(msft),
  side: 'long',
  avg_entry_price: '400',
  market_value: String(msft * 420),
  current_price: '420',
});
const order = (fields: Record<string, unknown>) => ({
  id: `o-${String(fields.client_order_id)}`,
  asset_class: 'us_equity',
  type: 'market',
  time_in_force: 'day',
  ...fields,
});

describe('Sync with Alpaca (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const alpaca = createMockAlpaca([
      {
        path: '/v2/account',
        body: { id: 'id-PA7', account_number: 'PA7', status: 'ACTIVE' },
      },
      { path: '/v2/positions', respond: () => (msft ? [position()] : []) },
      {
        path: '/v2/orders',
        respond: ({ url }: MockRequest) =>
          url.searchParams.get('status') === 'open'
            ? [
                order({
                  client_order_id: 'dashboard-1',
                  symbol: 'NVDA',
                  side: 'buy',
                  qty: '1',
                  status: 'new',
                  filled_qty: '0',
                  submitted_at: '2026-10-20T14:00:00Z',
                }),
              ]
            : [
                order({
                  client_order_id: 'b2',
                  symbol: 'MSFT',
                  side: 'buy',
                  status: 'filled',
                  filled_qty: '2',
                  filled_at: '2026-05-01T15:00:00Z',
                }),
                order({
                  client_order_id: 'b1',
                  symbol: 'MSFT',
                  side: 'buy',
                  status: 'filled',
                  filled_qty: '1',
                  filled_at: '2026-03-02T15:00:00Z',
                }),
              ],
      },
      {
        path: '/v2/orders:by_client_order_id',
        respond: ({ url }: MockRequest) =>
          order({
            client_order_id: url.searchParams.get('client_order_id'),
            symbol: 'NVDA',
            side: 'buy',
            status: 'new',
            filled_qty: '0',
          }),
      },
      { path: '/v2/stocks/bars', body: { bars: {}, next_page_token: null } },
    ]);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ALPACA_CLIENT)
      .useValue(alpaca)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await forgetAccounts(app);
    await app
      .get<Model<MyStocksDoc>>(getModelToken(MyStocksDoc.name))
      .deleteMany({});
    await app.init();
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());

  it('brings in what the account already holds when it is added', async () => {
    const res = await http()
      .post('/api/v1/accounts')
      .send({ name: 'Mine', keyId: 'PKMINE00007', secret: 'mine-secret' })
      .expect(200);
    expect(res.body.synced).toMatchObject({
      added: [{ symbol: 'MSFT', side: 'buy', qty: 3, price: 400 }],
      removed: [],
      orders: 1,
    });
    const mine = await http().get('/api/v1/trade/my-stocks').expect(200);
    expect(mine.body.positions).toMatchObject([
      { symbol: 'MSFT', qty: 3, avgPrice: 400 },
    ]);
    // Bought since the oldest buy the 3 shares need.
    expect(mine.body.positions[0].openedAt).toBe('2026-03-02T15:00:00.000Z');
    expect(mine.body.pending).toMatchObject([
      { clientOrderId: 'dashboard-1', symbol: 'NVDA', side: 'buy' },
    ]);
  });

  it('the Sync button catches up with a sale made outside the app', async () => {
    msft = 1;
    const res = await http().post('/api/v1/trade/sync').expect(200);
    expect(res.body.result).toMatchObject({
      added: [],
      removed: [{ symbol: 'MSFT', side: 'sell', qty: 2, price: 420 }],
      orders: 0, // the NVDA order is already followed
    });
    expect(res.body.view.positions).toMatchObject([{ symbol: 'MSFT', qty: 1 }]);
    // Nothing more to do the second time.
    const again = await http().post('/api/v1/trade/sync').expect(200);
    expect(again.body.result).toMatchObject({ added: [], removed: [] });
  });
});
