import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/mongo-global-setup.ts'],
    // Takes precedence over .env, so e2e runs never use real Alpaca keys.
    env: {
      ALPACA_API_KEY: 'test-key-id',
      ALPACA_API_SECRET: 'test-secret',
      ALPACA_PAPER: 'true',
      ALPACA_STREAMS_ENABLED: 'false',
      PAPER_TRADING_ENABLED: 'false', // the API works; the daily runner doesn't tick
      AUTOPILOT_SCHEDULER_ENABLED: 'false',
      NOTIFY_WEBHOOK_URL: '',
      ALPHAVANTAGE_API_KEY: '',
      SEC_USER_AGENT: '',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '',
      OPENAI_API_KEY: '', // never call OpenAI from tests
    },
  },
});
