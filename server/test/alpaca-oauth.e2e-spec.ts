import { createMockAlpaca } from '@alpacahq/alpaca-trade-api/testing';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';

// The login on, and Log in with Alpaca set up.
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('admin-password', 4);
process.env.JWT_SECRET = 'z'.repeat(40);
process.env.ALPACA_OAUTH_CLIENT_ID = 'client-123';
process.env.ALPACA_OAUTH_CLIENT_SECRET = 'client-secret';
process.env.PUBLIC_URL = 'https://bullwether.test';

/** Alpaca's token endpoint (mocked): each code gives a token, each token opens one account. */
const TOKENS: Record<string, string> = {
  'code-new': 'tok-PA5',
  'code-again': 'tok-PA5-fresh',
  'code-second': 'tok-PA6',
  'code-third': 'tok-PA7',
};
const accountOf = (token: string) => token.slice(4, 7);
const factory = (token: string) =>
  createMockAlpaca(
    [
      {
        path: '/v2/account',
        body: {
          id: `id-${accountOf(token)}`,
          account_number: accountOf(token),
          status: 'ACTIVE',
        },
      },
      // Already holds 2 MSFT: the sync after the login brings them in.
      {
        path: '/v2/positions',
        body: [
          {
            asset_id: '9',
            symbol: 'MSFT',
            exchange: 'NASDAQ',
            asset_class: 'us_equity',
            qty: '2',
            side: 'long',
            avg_entry_price: '400',
            market_value: '840',
            current_price: '420',
          },
        ],
      },
      { path: '/v2/orders', body: [] },
      { path: '/v2/stocks/bars', body: { bars: {}, next_page_token: null } },
    ],
    { retry: false },
  );

describe('Log in with Alpaca (e2e)', () => {
  let app: INestApplication<App>;
  let db: Connection;
  const exchanged: string[] = [];

  beforeAll(async () => {
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const href = url instanceof Request ? url.url : url.toString();
      // The Bank of Israel's dollar rate (no real request from tests): 3.5.
      if (href.includes('boi.gov.il'))
        return Promise.resolve(
          new Response(
            `TIME_PERIOD,OBS_VALUE\n${new Date().toISOString().slice(0, 10)},3.5`,
          ),
        );
      if (!href.startsWith('https://api.alpaca.markets/oauth/token'))
        return realFetch(url, init);
      const form = init?.body as URLSearchParams;
      exchanged.push(form.get('client_secret') ?? '');
      const token = TOKENS[form.get('code') ?? ''];
      return Promise.resolve(
        new Response(
          JSON.stringify(
            token
              ? { access_token: token, token_type: 'bearer' }
              : { message: 'bad code' },
          ),
          { status: token ? 200 : 401 },
        ),
      );
    });
    const { ALPACA_CLIENT_FACTORY } =
      await import('../src/alpaca/alpaca.constants.js');
    const { AppModule } = await import('../src/app.module.js');
    const { setupApp } = await import('../src/app.setup.js');
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ALPACA_CLIENT_FACTORY)
      .useValue(factory)
      .compile();
    app = ref.createNestApplication({ bufferLogs: true });
    setupApp(app);
    db = app.get(getConnectionToken());
    await Promise.all(
      ['users', 'alpaca_accounts', 'alpaca_signups', 'my_stocks'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
    await app.init();
  });
  afterAll(() => app.close());

  const agent = () => request.agent(app.getHttpServer());
  /** Goes to Alpaca and back with `code` (as the browser would): the callback's redirect. */
  const signIn = async (
    a: ReturnType<typeof agent>,
    code: string,
    mode = 'login',
  ) => {
    const start = await a
      .get(`/api/v1/auth/alpaca/start?mode=${mode}`)
      .expect(302);
    const state = new URL(start.headers.location).searchParams.get('state');
    return a
      .get(`/api/v1/auth/alpaca/callback?code=${code}&state=${state}`)
      .expect(302);
  };
  let dana: ReturnType<typeof agent>;

  it("sends the browser to Alpaca's sign-in for a paper account", async () => {
    const status = await request(app.getHttpServer())
      .get('/api/v1/auth/alpaca')
      .expect(200);
    expect(status.body).toEqual({ enabled: true, pending: null });
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/alpaca/start?mode=login')
      .expect(302);
    const url = new URL(res.headers.location);
    expect(url.origin + url.pathname).toBe(
      'https://app.alpaca.markets/oauth/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'client-123',
      redirect_uri: 'https://bullwether.test/api/v1/auth/alpaca/callback',
      env: 'paper',
      scope: 'account:write trading data',
    });
    expect(res.headers['set-cookie']?.[0]).toMatch(
      /^alpaca_oauth=login\.[\w-]+;.*HttpOnly/,
    );
  });

  it('refuses a callback that this browser did not start', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/alpaca/callback?code=code-new&state=forged')
      .expect(302);
    expect(res.headers.location).toMatch(/^\/\?alpacaError=.*expired/);
  });

  it('signs up a new Alpaca user after their email, and syncs their stocks', async () => {
    dana = agent();
    const res = await signIn(dana, 'code-new');
    expect(res.headers.location).toBe('/');
    expect(exchanged).toEqual(['client-secret']);
    const status = await dana.get('/api/v1/auth/alpaca').expect(200);
    expect(status.body.pending).toBe('PA5');
    const done = await dana
      .post('/api/v1/auth/alpaca/complete')
      .send({ email: 'Dana@Example.com', acceptTerms: true })
      .expect(200);
    expect(done.body.user).toEqual({ email: 'dana@example.com', admin: false });
    const list = await dana.get('/api/v1/accounts').expect(200);
    expect(list.body.accounts).toMatchObject([
      { id: 'PA5', auth: 'oauth', keyHint: 'OAuth' },
    ]);
    // The login's sync brought in what the account already holds.
    await vi.waitFor(
      async () => {
        const mine = await dana.get('/api/v1/trade/my-stocks').expect(200);
        expect(mine.body.positions).toMatchObject([{ symbol: 'MSFT', qty: 2 }]);
      },
      { timeout: 5000, interval: 200 },
    );
    // No password: the password login refuses it.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'dana@example.com', password: 'anything-at-all' })
      .expect(401);
  });

  it('logs the same user in next time, with a fresh token', async () => {
    const before = await db
      .collection('alpaca_accounts')
      .findOne({ _id: 'PA5' as never });
    const again = agent();
    const res = await signIn(again, 'code-again');
    expect(res.headers.location).toBe('/');
    expect(res.headers['set-cookie']?.join(';')).toMatch(/accessToken=/);
    const me = await again.get('/api/v1/auth/me').expect(200);
    expect(me.body.user).toEqual({ email: 'dana@example.com', admin: false });
    const after = await db
      .collection('alpaca_accounts')
      .findOne({ _id: 'PA5' as never });
    expect(after?.token).not.toBe(before?.token);
    expect(JSON.stringify(after)).not.toContain('tok-PA5');
  });

  it('connects another account to the user who is logged in', async () => {
    const res = await signIn(dana, 'code-second', 'connect');
    expect(res.headers.location).toMatch(
      /^\/\?page=accounts&notice=Connected%20PA6/,
    );
    const list = await dana.get('/api/v1/accounts').expect(200);
    expect(list.body.accounts.map((a: { id: string }) => a.id)).toEqual([
      'PA5',
      'PA6',
    ]);
  });

  it('refuses a sign-up with an email that already has a user', async () => {
    const other = agent();
    await signIn(other, 'code-third');
    await other
      .post('/api/v1/auth/alpaca/complete')
      .send({ email: 'dana@example.com', acceptTerms: true })
      .expect(409);
    await other
      .post('/api/v1/auth/alpaca/complete')
      .send({ email: 'admin@example.com', acceptTerms: true })
      .expect(409);
  });
});
