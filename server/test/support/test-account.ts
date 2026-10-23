import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';

/** Forgets the accounts earlier test files added (call before app.init(), which loads them). */
export async function forgetAccounts(app: INestApplication): Promise<void> {
  await app
    .get<Connection>(getConnectionToken())
    .collection('alpaca_accounts')
    .deleteMany({});
}

/** Adds a paper account through the API (the mock Alpaca answers for any key). */
export async function addTestAccount(
  app: INestApplication<App>,
  headers: Record<string, string> = {},
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/accounts')
    .set(headers)
    .send({ name: 'Test', keyId: 'PKTEST00001', secret: 'test-secret' });
  if (res.status !== 200)
    throw new Error(
      `Adding the test account failed: ${JSON.stringify(res.body)}`,
    );
  return (res.body as { id: string }).id;
}
