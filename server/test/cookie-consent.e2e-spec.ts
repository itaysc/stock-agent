import { createMockAlpaca } from '@alpacahq/alpaca-trade-api/testing';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ALPACA_CLIENT } from '../src/alpaca/alpaca.constants.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';

describe('Cookie choices (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ALPACA_CLIENT)
      .useValue(createMockAlpaca([]))
      .compile();
    app = ref.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app
      .get<Connection>(getConnectionToken())
      .collection('cookie_consents')
      .deleteMany({});
    await app.init();
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());

  it("saves the user's choice with its time and policy version", async () => {
    expect(
      (await http().get('/api/v1/consent/cookies').expect(200)).body,
    ).toEqual({
      consent: null,
    });
    await http()
      .put('/api/v1/consent/cookies')
      .send({ functional: 'yes', policyVersion: '1' })
      .expect(400);
    const saved = await http()
      .put('/api/v1/consent/cookies')
      .send({ functional: false, policyVersion: '1' })
      .expect(200);
    expect(saved.body.consent).toMatchObject({
      functional: false,
      policyVersion: '1',
    });
    expect(Date.parse(saved.body.consent.decidedAt)).toBeGreaterThan(
      Date.now() - 60_000,
    );
    // Changing it later replaces it.
    await http()
      .put('/api/v1/consent/cookies')
      .send({ functional: true, policyVersion: '1' })
      .expect(200);
    const now = await http().get('/api/v1/consent/cookies').expect(200);
    expect(now.body.consent).toMatchObject({
      functional: true,
      policyVersion: '1',
    });
  });
});
