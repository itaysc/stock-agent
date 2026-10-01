import { z } from 'zod';
import { tradingEnv } from './trading.env.js';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    // Local-only by default. Use 0.0.0.0 to expose it (and set API_TOKEN: the API has no other login).
    HOST: z.string().default('127.0.0.1'),
    // Every request except GET /health needs "Authorization: Bearer <API_TOKEN>" (or x-api-key).
    // Empty = no check (local development only). Required on Railway.
    API_TOKEN: z.string().default(''),
    // Set by Railway on every deployment.
    RAILWAY_ENVIRONMENT: z.string().optional(),
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
  })
  .superRefine((env, ctx) => {
    // Deployed: refuse to start without production mode and a real API token.
    if (!env.RAILWAY_ENVIRONMENT?.trim()) return;
    if (env.NODE_ENV !== 'production')
      ctx.addIssue({
        code: 'custom',
        path: ['NODE_ENV'],
        message: 'must be production on Railway',
      });
    if (env.API_TOKEN.length < 24)
      ctx.addIssue({
        code: 'custom',
        path: ['API_TOKEN'],
        message:
          'is required on Railway (at least 24 characters, e.g. openssl rand -hex 32): the API trades your account',
      });
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
