import { validateEnv } from './env.js';

const required = {
  MONGODB_URI: 'mongodb://localhost:27018/stock-invest',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv(required)).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      API_TOKEN: '',
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD_HASH: '',
      JWT_SECRET: '',
      JWT_EXPIRES_IN: '12h',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: true,
      MONGODB_URI: 'mongodb://localhost:27018/stock-invest',
      ACCOUNTS_SECRET_KEY: '',
      ALPACA_OAUTH_CLIENT_ID: '',
      ALPACA_OAUTH_CLIENT_SECRET: '',
      PUBLIC_URL: '',
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
      TAX_RECORDS_SYNC_ENABLED: true,
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
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
    expect(env.SWAGGER_ENABLED).toBe(false);
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

  it('wants a long accounts secret key', () => {
    expect(() =>
      validateEnv({ ...required, ACCOUNTS_SECRET_KEY: 'short' }),
    ).toThrow(/ACCOUNTS_SECRET_KEY/);
    const key = Buffer.alloc(32, 7).toString('base64');
    expect(
      validateEnv({ ...required, ACCOUNTS_SECRET_KEY: key })
        .ACCOUNTS_SECRET_KEY,
    ).toBe(key);
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

  it('wants the site address with Log in with Alpaca', () => {
    const oauth = {
      ...required,
      ALPACA_OAUTH_CLIENT_ID: 'id',
      ALPACA_OAUTH_CLIENT_SECRET: 'secret',
    };
    expect(() => validateEnv(oauth)).toThrow(/PUBLIC_URL/);
    expect(
      validateEnv({ ...oauth, PUBLIC_URL: 'https://bullwether.app/' })
        .PUBLIC_URL,
    ).toBe('https://bullwether.app');
    expect(() =>
      validateEnv({ ...required, ALPACA_OAUTH_CLIENT_ID: 'id' }),
    ).toThrow(/go together/);
  });
});
