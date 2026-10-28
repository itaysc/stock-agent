import { createMockAlpaca } from '@alpacahq/alpaca-trade-api/testing';
import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AlpacaAccountDoc } from '../src/accounts/alpaca-account.schema.js';
import { ALPACA_CLIENT_FACTORY } from '../src/alpaca/alpaca.constants.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { MyStocksDoc } from '../src/trade/my-stocks.store.js';

/** A mock Alpaca per key: PKFIRST0001 opens PA1, PKSECOND123 opens PA2, anything else is refused. */
const accountOf: Record<string, string> = {
  PKFIRST0001: 'PA1',
  PKSECOND123: 'PA2',
};
const factory = (keyId: string) => {
  const number = accountOf[keyId];
  return createMockAlpaca(
    [
      number
        ? {
            path: '/v2/account',
            body: {
              id: `id-${number}`,
              account_number: number,
              status: 'ACTIVE',
            },
          }
        : {
            path: '/v2/account',
            status: 401,
            body: { message: 'unauthorized' },
          },
      { path: '/v2/positions', body: [] },
      { path: '/v2/orders', body: [] },
      { path: '/v2/stocks/bars', body: { bars: {}, next_page_token: null } },
    ],
    { retry: false },
  );
};

describe('Accounts API (e2e)', () => {
  let app: INestApplication<App>;
  let saved: Model<AlpacaAccountDoc>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ALPACA_CLIENT_FACTORY)
      .useValue(factory)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    saved = app.get(getModelToken(AlpacaAccountDoc.name));
    await saved.deleteMany({});
    await app.init();
    await app
      .get<Model<MyStocksDoc>>(getModelToken(MyStocksDoc.name))
      .deleteMany({});
  });

  afterAll(async () => {
    await saved.deleteMany({});
    await app.close();
  });
  const http = () => request(app.getHttpServer());

  it('starts with no account: everything waits for one', async () => {
    const res = await http().get('/api/v1/accounts').expect(200);
    // No login in this test: the admin, who may paste a key.
    expect(res.body).toEqual({
      canAdd: true,
      keyAllowed: true,
      canOpenPaper: false,
      accounts: [],
    });
    await http().get('/api/v1/trade/my-stocks').expect(409);
    await http()
      .post('/api/v1/accounts')
      .send({ name: 'First', keyId: 'PKFIRST0001', secret: 'first-secret' })
      .expect(200);
  });

  it('adds a paper key checked with Alpaca, saved encrypted and never returned', async () => {
    await http()
      .post('/api/v1/accounts')
      .send({ name: 'Bad', keyId: 'PKWRONG0000', secret: 'whatever1' })
      .expect(400);
    const res = await http()
      .post('/api/v1/accounts')
      .send({ name: 'Second', keyId: 'PKSECOND123', secret: 'topsecret1' })
      .expect(200);
    expect(res.body).toEqual({
      id: 'PA2',
      name: 'Second',
      paper: true,
      keyHint: 'D123',
      auth: 'key',
      owner: '',
      // An empty account: nothing to bring into the Trade page.
      synced: { added: [], removed: [], orders: 0, skipped: [] },
    });
    const doc = await saved.findById('PA2').lean();
    expect(doc?.keyId).not.toContain('PKSECOND123');
    expect(doc?.secret).not.toContain('topsecret1');
    await http()
      .post('/api/v1/accounts')
      .send({ name: 'Again', keyId: 'PKSECOND123', secret: 'topsecret1' })
      .expect(409);
    const list = await http().get('/api/v1/accounts').expect(200);
    expect(JSON.stringify(list.body)).not.toContain('topsecret1');
    expect(list.body.accounts.map((a: { id: string }) => a.id)).toEqual([
      'PA1',
      'PA2',
    ]);
  });

  it("keeps each account's data apart", async () => {
    await http()
      .put('/api/v1/trade/watchlist')
      .set('X-Account-Id', 'PA2')
      .send({ symbols: ['NVDA'] })
      .expect(200);
    const second = await http()
      .get('/api/v1/trade/my-stocks')
      .set('X-Account-Id', 'PA2')
      .expect(200);
    expect(second.headers['x-account-id']).toBe('PA2');
    expect(second.body.watchlist).toMatchObject([{ symbol: 'NVDA' }]);
    // No header: the first account, which has its own (empty) list.
    const first = await http().get('/api/v1/trade/my-stocks').expect(200);
    expect(first.headers['x-account-id']).toBe('PA1');
    expect(first.body.watchlist).toEqual([]);
  });

  it('renames and deletes an account', async () => {
    await http()
      .patch('/api/v1/accounts/PA2')
      .send({ name: 'Renamed' })
      .expect(200);
    await http().delete('/api/v1/accounts/PA9').expect(404);
    await http().delete('/api/v1/accounts/PA2').expect(204);
    expect(await saved.countDocuments()).toBe(1);
    const list = await http().get('/api/v1/accounts').expect(200);
    expect(list.body.accounts).toHaveLength(1);
  });
});
