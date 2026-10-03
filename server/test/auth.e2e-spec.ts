import { createMockAlpaca } from '@alpacahq/alpaca-trade-api/testing';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';

// The login turned on (the other e2e tests run without it).
process.env.ADMIN_EMAIL = 'me@example.com';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('right-password', 4);
process.env.JWT_SECRET = 'x'.repeat(40);
process.env.API_TOKEN = 'script-token-0123456789abcdef';

describe('login (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const { ALPACA_CLIENT } = await import('../src/alpaca/alpaca.constants.js');
    const { AppModule } = await import('../src/app.module.js');
    const { setupApp } = await import('../src/app.setup.js');
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ALPACA_CLIENT)
      .useValue(
        createMockAlpaca([
          { path: '/v2/account', body: { id: 'acc-1', status: 'ACTIVE' } },
        ]),
      )
      .compile();
    app = ref.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());

  it('keeps the API and pages closed, /health open', async () => {
    await http().get('/health').expect(200);
    await http().get('/api/v1/backtests/options').expect(401);
    await http().get('/docs').expect(401);
    const me = await http().get('/api/v1/auth/me').expect(200);
    expect(me.body).toEqual({ loginRequired: true, user: null });
  });

  it('refuses a wrong password, and returns a JWT (and a cookie) for the right one', async () => {
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'me@example.com', password: 'nope' })
      .expect(401);
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'ME@example.com', password: 'right-password' })
      .expect(200);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      user: { email: 'me@example.com' },
      expiresIn: '12h',
    });
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(
      /^accessToken=.+; Max-Age=43200; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/,
    );
    // The JWT opens the API, as a cookie (web app) or a Bearer header.
    await http()
      .get('/api/v1/backtests/options')
      .set('Cookie', cookie.split(';')[0])
      .expect(200);
    await http()
      .get('/api/v1/backtests/options')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    const me = await http()
      .get('/api/v1/auth/me')
      .set('Cookie', cookie.split(';')[0])
      .expect(200);
    expect(me.body.user).toEqual({ email: 'me@example.com' });
    // So does the API_TOKEN (scripts); a forged JWT does not.
    await http()
      .get('/api/v1/backtests/options')
      .set('x-api-key', 'script-token-0123456789abcdef')
      .expect(200);
    await http()
      .get('/api/v1/backtests/options')
      .set('Authorization', `Bearer ${res.body.accessToken}x`)
      .expect(401);
  });

  it('blocks an address after 5 wrong passwords', async () => {
    for (let i = 0; i < 5; i++)
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'me@example.com', password: `bad-${i}` })
        .expect(401);
    const blocked = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'me@example.com', password: 'right-password' })
      .expect(429);
    expect(blocked.body.message).toMatch(/Too many failed logins/);
  });
});
