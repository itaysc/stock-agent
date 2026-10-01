import { z } from 'zod';
import { tradingEnv } from './trading.env.js';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // Local-only by default: there is no authentication yet. Use 0.0.0.0 to expose it.
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // Comma-separated list of allowed origins; empty disables CORS.
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  SWAGGER_ENABLED: z.stringbool().default(true),

  MONGODB_URI: z
    .string()
    .regex(
      /^mongodb(\+srv)?:\/\//,
      'must be a mongodb:// or mongodb+srv:// URI',
    ),

  // Alpaca (broker + market data). Paper and live accounts have separate keys.
  ALPACA_API_KEY: z.string().min(1, 'ALPACA_API_KEY is required'),
  ALPACA_API_SECRET: z.string().min(1, 'ALPACA_API_SECRET is required'),
  // true = paper trading (default), false = LIVE trading with real money.
  ALPACA_PAPER: z.stringbool().default(true),
  // Market data feed: 'iex' is free, 'sip' requires a paid data subscription.
  ALPACA_DATA_FEED: z.enum(['iex', 'sip']).default('iex'),
  // Real-time WebSocket streams (order updates + market data). Alpaca allows
  // only one market data connection per account, so run one streaming instance.
  ALPACA_STREAMS_ENABLED: z.stringbool().default(true),

  ...tradingEnv,
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
