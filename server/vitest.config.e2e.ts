import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/mongo-global-setup.ts'],
    // One file at a time: they share one database (accounts included).
    fileParallelism: false,
    // Takes precedence over .env, so e2e runs never use real settings.
    env: {
      // A fixed test key for the accounts added in tests (32 bytes, base64).
      ACCOUNTS_SECRET_KEY: 'dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMTIzNDU=',
      ALPACA_STREAMS_ENABLED: 'false',
      PAPER_TRADING_ENABLED: 'false', // the API works; the daily runner doesn't tick
      AUTOPILOT_SCHEDULER_ENABLED: 'false',
      TAX_RECORDS_SYNC_ENABLED: 'false', // no broker or Bank of Israel calls from tests
      NOTIFY_WEBHOOK_URL: '',
      ALPHAVANTAGE_API_KEY: '',
      SEC_USER_AGENT: '',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '',
      OPENAI_API_KEY: '', // never call OpenAI from tests
      // No login or API token: the API is open in tests (auth.e2e-spec turns the login on).
      API_TOKEN: '',
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD_HASH: '',
      JWT_SECRET: '',
    },
  },
});
