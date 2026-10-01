import { createMockAlpaca } from '@alpacahq/alpaca-trade-api/testing';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ALPACA_CLIENT } from './../src/alpaca/alpaca.constants.js';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ALPACA_CLIENT)
      .useValue(
        createMockAlpaca([
          { path: '/v2/account', body: { id: 'acc-1', status: 'ACTIVE' } },
        ]),
      )
      .compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
  });

  it('GET /health returns ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.info.mongodb.status).toBe('up');
        expect(res.headers['x-request-id']).toBeDefined();
      });
  });

  it('unknown routes return 404', () => {
    return request(app.getHttpServer()).get('/api/v1/nope').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
