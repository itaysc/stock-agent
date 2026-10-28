import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';

// The login on, and Continue with Google set up.
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('admin-password', 4);
process.env.JWT_SECRET = 'g'.repeat(40);
process.env.GOOGLE_CLIENT_ID = 'client-123.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
process.env.PUBLIC_URL = 'https://bullwether.test';

/** Google (mocked): each code gives an access token for one person. */
const PEOPLE: Record<string, object> = {
  'code-dana': {
    sub: 'g-dana',
    email: 'Dana@Example.com',
    email_verified: true,
    name: 'Dana Cohen',
    picture: 'https://lh3.googleusercontent.com/dana',
  },
  // The same Google account, its email changed since.
  'code-dana-renamed': {
    sub: 'g-dana',
    email: 'dana.cohen@example.com',
    email_verified: true,
    name: 'Dana C.',
  },
  'code-pat': { sub: 'g-pat', email: 'pat@example.com', email_verified: true },
  'code-eve': { sub: 'g-eve', email: 'eve@example.com', email_verified: false },
  'code-admin': {
    sub: 'g-admin',
    email: 'admin@example.com',
    email_verified: true,
  },
};

describe('Continue with Google (e2e)', () => {
  let app: INestApplication<App>;
  let db: Connection;
  const secrets: string[] = [];

  beforeAll(async () => {
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const href = url instanceof Request ? url.url : url.toString();
      const json = (body: object, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(body), { status }));
      if (href === 'https://oauth2.googleapis.com/token') {
        const form = init?.body as URLSearchParams;
        secrets.push(form.get('client_secret') ?? '');
        const code = form.get('code') ?? '';
        return PEOPLE[code]
          ? json({ access_token: `at-${code}`, token_type: 'Bearer' })
          : json({ error_description: 'Bad code' }, 400);
      }
      if (href === 'https://openidconnect.googleapis.com/v1/userinfo') {
        const auth = new Headers(init?.headers).get('authorization') ?? '';
        const person = PEOPLE[auth.replace('Bearer at-', '')];
        return person ? json(person) : json({ error: 'invalid_token' }, 401);
      }
      return realFetch(url, init);
    });
    const { AppModule } = await import('../src/app.module.js');
    const { setupApp } = await import('../src/app.setup.js');
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = ref.createNestApplication({ bufferLogs: true });
    setupApp(app);
    db = app.get(getConnectionToken());
    await Promise.all(
      ['users', 'google_signups', 'alpaca_accounts'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
    await app.init();
  });
  afterAll(() => app.close());

  const agent = () => request.agent(app.getHttpServer());
  const user = (email: string) =>
    db.collection('users').findOne({ _id: email as never });
  /** Goes to Google and back with `code` (as the browser would): the callback's redirect. */
  const signIn = async (a: ReturnType<typeof agent>, code: string) => {
    const start = await a.get('/api/v1/auth/google/start').expect(302);
    const state = new URL(start.headers.location).searchParams.get('state');
    return a
      .get(`/api/v1/auth/google/callback?code=${code}&state=${state}`)
      .expect(302);
  };

  it("sends the browser to Google's sign-in, asking only who the person is", async () => {
    const status = await request(app.getHttpServer())
      .get('/api/v1/auth/google')
      .expect(200);
    expect(status.body).toEqual({ enabled: true, pending: null });
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/google/start')
      .expect(302);
    const url = new URL(res.headers.location);
    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'client-123.apps.googleusercontent.com',
      redirect_uri: 'https://bullwether.test/api/v1/auth/google/callback',
      scope: 'openid email profile',
    });
    expect(res.headers['set-cookie']?.[0]).toMatch(
      /^google_oauth=[\w-]+;.*HttpOnly/,
    );
  });

  it('refuses a callback that this browser did not start', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/google/callback?code=code-dana&state=forged')
      .expect(302);
    expect(res.headers.location).toMatch(/^\/\?authError=.*expired/);
  });

  it('signs up a new user once they accept the terms, keeping their Google details', async () => {
    const dana = agent();
    expect((await signIn(dana, 'code-dana')).headers.location).toBe('/');
    expect(secrets).toEqual(['google-secret']);
    // Not a user yet: the terms step.
    expect((await dana.get('/api/v1/auth/me')).body.user).toBeNull();
    const status = await dana.get('/api/v1/auth/google').expect(200);
    expect(status.body.pending).toEqual({
      email: 'dana@example.com',
      name: 'Dana Cohen',
    });
    await dana.post('/api/v1/auth/google/complete').send({}).expect(400);
    const done = await dana
      .post('/api/v1/auth/google/complete')
      .send({ acceptTerms: true })
      .expect(200);
    expect(done.body.user).toEqual({ email: 'dana@example.com', admin: false });
    expect((await dana.get('/api/v1/auth/me')).body.user).toEqual({
      email: 'dana@example.com',
      admin: false,
    });
    const saved = await user('dana@example.com');
    expect(saved).toMatchObject({
      termsVersion: '2026-10-28',
      google: {
        googleId: 'g-dana',
        email: 'dana@example.com',
        name: 'Dana Cohen',
        picture: 'https://lh3.googleusercontent.com/dana',
      },
    });
    expect(saved?.passwordHash).toBeUndefined();
    expect(saved?.google.connectedAt).toBeInstanceOf(Date);
    // Google's tokens are never kept.
    expect(JSON.stringify(saved)).not.toContain('at-code');
    expect(await db.collection('google_signups').countDocuments()).toBe(0);
  });

  it('logs the same Google account in again, even with a new email', async () => {
    const before = await user('dana@example.com');
    const dana = agent();
    expect((await signIn(dana, 'code-dana-renamed')).headers.location).toBe(
      '/',
    );
    const me = await dana.get('/api/v1/auth/me').expect(200);
    expect(me.body.user).toMatchObject({ email: 'dana@example.com' });
    const after = await user('dana@example.com');
    expect(after?.google).toMatchObject({
      email: 'dana.cohen@example.com',
      name: 'Dana C.',
      connectedAt: before?.google.connectedAt,
    });
    expect(await db.collection('users').countDocuments()).toBe(1);
  });

  it('links Google to an existing user by the email Google verified', async () => {
    await db.collection('users').insertOne({
      _id: 'pat@example.com' as never,
      passwordHash: bcrypt.hashSync('pat-password-1', 4),
      createdAt: new Date(),
    });
    const pat = agent();
    expect((await signIn(pat, 'code-pat')).headers.location).toBe('/');
    expect((await pat.get('/api/v1/auth/me')).body.user).toMatchObject({
      email: 'pat@example.com',
    });
    expect(await user('pat@example.com')).toMatchObject({
      google: { googleId: 'g-pat' },
    });
    // The password still works too.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'pat@example.com', password: 'pat-password-1' })
      .expect(200);
  });

  it('refuses a Google account whose email is not verified', async () => {
    const eve = agent();
    const res = await signIn(eve, 'code-eve');
    expect(res.headers.location).toMatch(/^\/\?authError=.*verified/);
    expect(await user('eve@example.com')).toBeNull();
    expect(await db.collection('google_signups').countDocuments()).toBe(0);
  });

  it("logs the admin's Google in as the admin, who isn't listed with the users", async () => {
    const admin = agent();
    expect((await signIn(admin, 'code-admin')).headers.location).toBe('/');
    expect((await admin.get('/api/v1/auth/me')).body.user).toEqual({
      email: 'admin@example.com',
      admin: true,
    });
    const list = await admin.get('/api/v1/users').expect(200);
    expect(list.body.users).toMatchObject([
      { email: 'dana@example.com', google: true, password: false },
      { email: 'pat@example.com', google: true, password: true },
    ]);
    expect(list.body.users).toHaveLength(2);
  });
});
