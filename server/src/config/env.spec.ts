import { validateEnv } from './env.js';

const required = {
  MONGODB_URI: 'mongodb://localhost:27018/stock-invest',
  ALPACA_API_KEY: 'key-id',
  ALPACA_API_SECRET: 'secret',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv(required)).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      API_TOKEN: '',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: true,
      MONGODB_URI: 'mongodb://localhost:27018/stock-invest',
      ALPACA_API_KEY: 'key-id',
      ALPACA_API_SECRET: 'secret',
      ALPACA_PAPER: true,
      ALPACA_DATA_FEED: 'iex',
      ALPACA_STREAMS_ENABLED: true,
      RISK_MAX_POSITION_VALUE: 10_000,
      RISK_MAX_TOTAL_EXPOSURE: 50_000,
      RISK_MAX_DAILY_LOSS: 1_000,
      RISK_MAX_ORDERS_PER_MINUTE: 10,
      LIVE_STRATEGIES: [],
      OPENAI_API_KEY: '',
      OPENAI_MODEL: 'gpt-5.6-luna',
      STRATEGIES_ALLOW_LIVE: false,
      PAPER_TRADING_ENABLED: true,
      PAPER_TRADING_POLL_MINUTES: 15,
      AUTOPILOT_SCHEDULER_ENABLED: true,
      NOTIFY_WEBHOOK_URL: '',
      ALPHAVANTAGE_API_KEY: '',
      SEC_USER_AGENT: '',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '',
      TELEGRAM_COMMANDS_ENABLED: true,
    });
  });

  it('parses and coerces values', () => {
    const env = validateEnv({
      ...required,
      PORT: '8080',
      CORS_ORIGINS: 'http://a.com, http://b.com',
      SWAGGER_ENABLED: 'false',
      ALPACA_PAPER: 'false',
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.ALPACA_PAPER).toBe(false);
  });

  it('throws on invalid values', () => {
    expect(() => validateEnv({ ...required, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects a non-MongoDB URI', () => {
    expect(() =>
      validateEnv({ ...required, MONGODB_URI: 'postgres://localhost/db' }),
    ).toThrow(/MONGODB_URI/);
  });

  it('parses LIVE_STRATEGIES JSON with defaults', () => {
    const env = validateEnv({
      ...required,
      LIVE_STRATEGIES:
        '[{"strategy":"sma-crossover","symbols":["AAPL"],"params":{"fast":10}}]',
    });
    expect(env.LIVE_STRATEGIES).toEqual([
      {
        strategy: 'sma-crossover',
        symbols: ['AAPL'],
        timeframe: '1Min',
        params: { fast: '10' },
      },
    ]);
    expect(() =>
      validateEnv({ ...required, LIVE_STRATEGIES: 'not json' }),
    ).toThrow(/LIVE_STRATEGIES/);
    expect(() =>
      validateEnv({ ...required, LIVE_STRATEGIES: '[{"strategy":"x"}]' }),
    ).toThrow(/symbols/);
  });

  it('requires Alpaca credentials', () => {
    expect(() => validateEnv({ ALPACA_API_KEY: '' })).toThrow(
      /ALPACA_API_KEY is required[\s\S]*ALPACA_API_SECRET/,
    );
  });

  it('on Railway, refuses to start without production mode and an API token', () => {
    const railway = { ...required, RAILWAY_ENVIRONMENT: 'production' };
    expect(() => validateEnv(railway)).toThrow(
      /must be production on Railway[\s\S]*NODE_ENV[\s\S]*is required on Railway[\s\S]*API_TOKEN/,
    );
    expect(() =>
      validateEnv({ ...railway, NODE_ENV: 'production', API_TOKEN: 'short' }),
    ).toThrow(/API_TOKEN/);
    expect(
      validateEnv({
        ...railway,
        NODE_ENV: 'production',
        API_TOKEN: 'x'.repeat(32),
      }).API_TOKEN,
    ).toHaveLength(32);
  });
});
