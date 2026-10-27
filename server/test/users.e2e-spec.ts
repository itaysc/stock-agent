import { createMockAlpaca } from '@alpacahq/alpaca-trade-api/testing';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';

// The login on: the admin, and users who join with an invite.
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('admin-password', 4);
process.env.JWT_SECRET = 'y'.repeat(40);

/** The admin's key opens PA1; Dana's key opens PA3. */
const factory = (keyId: string) => {
  const number = { PKADMIN0001: 'PA1', PKDANA00001: 'PA3' }[keyId];
  return createMockAlpaca(
    [
      {
        path: '/v2/account',
        body: { id: `id-${number}`, account_number: number, status: 'ACTIVE' },
      },
    ],
    { retry: false },
  );
};

describe('Users and invites (e2e)', () => {
  let app: INestApplication<App>;
  let db: Connection;

  beforeAll(async () => {
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
      ['users', 'invites', 'alpaca_accounts'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
    await app.init();
  });
  afterAll(() => app.close());

  // Each agent keeps its own login cookie.
  const agent = () => request.agent(app.getHttpServer());
  let adminAgent: ReturnType<typeof agent>;
  let danaAgent: ReturnType<typeof agent>;
  let token = '';

  it('the admin invites someone with a one-time link', async () => {
    adminAgent = agent();
    await adminAgent
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'admin-password' })
      .expect(200);
    await adminAgent
      .post('/api/v1/accounts')
      .send({ name: 'Admin', keyId: 'PKADMIN0001', secret: 'admin-secret' })
      .expect(200);
    const res = await adminAgent
      .post('/api/v1/users/invites')
      .send({ note: 'Dana' })
      .expect(200);
    token = res.body.token;
    expect(token.length).toBeGreaterThan(20);
    const list = await adminAgent.get('/api/v1/users').expect(200);
    expect(list.body.invites).toMatchObject([{ note: 'Dana', expired: false }]);
    // Only the token's hash is stored.
    expect(
      JSON.stringify(await db.collection('invites').find().toArray()),
    ).not.toContain(token);
  });

  it('signs up once with the link, then logs in', async () => {
    const http = () => request(app.getHttpServer());
    await http().get(`/api/v1/auth/invites/${token}`).expect(200);
    await http().get('/api/v1/auth/invites/not-a-real-token-123').expect(404);
    await http()
      .post('/api/v1/auth/signup')
      .send({
        token,
        email: 'dana@example.com',
        password: 'short',
        acceptTerms: true,
      })
      .expect(400);
    // The terms must be accepted.
    const refused = await http()
      .post('/api/v1/auth/signup')
      .send({ token, email: 'dana@example.com', password: 'dana-password-1' })
      .expect(400);
    expect(JSON.stringify(refused.body)).toMatch(/accept the Terms of Use/);
    danaAgent = agent();
    const res = await danaAgent
      .post('/api/v1/auth/signup')
      .send({
        token,
        email: 'Dana@Example.com',
        password: 'dana-password-1',
        acceptTerms: true,
      })
      .expect(200);
    expect(res.body.user).toEqual({ email: 'dana@example.com', admin: false });
    // When they accepted which terms is kept with the user.
    const saved = await db
      .collection('users')
      .findOne({ _id: 'dana@example.com' as never });
    expect(saved).toMatchObject({ termsVersion: '2026-10-27' });
    expect(saved?.termsAcceptedAt).toBeInstanceOf(Date);
    await http()
      .post('/api/v1/auth/signup')
      .send({
        token,
        email: 'eve@example.com',
        password: 'eve-password-1',
        acceptTerms: true,
      })
      .expect(410);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'dana@example.com', password: 'dana-password-1' })
      .expect(200);
  });

  it("a user sees and uses only their own accounts; the admin sees everyone's", async () => {
    expect(
      (await danaAgent.get('/api/v1/accounts').expect(200)).body.accounts,
    ).toEqual([]);
    // Asking for the admin's account gets nothing.
    await danaAgent
      .get('/api/v1/trade/my-stocks')
      .set('X-Account-Id', 'PA1')
      .expect(409);
    await danaAgent.get('/api/v1/users').expect(403);

    await danaAgent
      .post('/api/v1/accounts')
      .send({ name: 'Mine', keyId: 'PKDANA00001', secret: 'dana-secret' })
      .expect(200);
    const mine = await danaAgent.get('/api/v1/accounts').expect(200);
    expect(mine.body.accounts).toEqual([
      {
        id: 'PA3',
        name: 'Mine',
        paper: true,
        keyHint: '0001',
        auth: 'key',
      },
    ]);
    await danaAgent.delete('/api/v1/accounts/PA1').expect(404);

    const all = await adminAgent.get('/api/v1/accounts').expect(200);
    expect(all.body.accounts).toMatchObject([
      { id: 'PA1', owner: 'admin@example.com' },
      { id: 'PA3', owner: 'dana@example.com' },
    ]);
  });

  it('removes a user only after their accounts, and their login stops', async () => {
    await adminAgent.delete('/api/v1/users/dana@example.com').expect(409);
    await danaAgent.delete('/api/v1/accounts/PA3').expect(204);
    await adminAgent.delete('/api/v1/users/dana@example.com').expect(204);
    await danaAgent.get('/api/v1/accounts').expect(401);
  });
});
