import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Starts an in-memory MongoDB for e2e tests. Runs before test files are
 * imported, so MONGODB_URI is set before AppModule validates the env
 * (and takes precedence over the real value in .env).
 */
export default async function setup() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('stock-invest-test');

  return async () => {
    await mongo.stop();
  };
}
