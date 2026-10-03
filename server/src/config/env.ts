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
    // The login (web app): your email and a bcrypt hash of your password (npm run hash-password),
    // and the secret that signs the JWTs it returns (at least 32 characters). All empty = no login.
    ADMIN_EMAIL: z.string().default(''),
    ADMIN_PASSWORD_HASH: z.string().default(''),
    JWT_SECRET: z.string().default(''),
    JWT_EXPIRES_IN: z.string().default('12h'),
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
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    // The login needs all three, and a long enough secret.
    const login = [env.ADMIN_EMAIL, env.ADMIN_PASSWORD_HASH, env.JWT_SECRET];
    if (login.some(Boolean) && !login.every(Boolean))
      issue(
        'ADMIN_EMAIL',
        'ADMIN_EMAIL, ADMIN_PASSWORD_HASH and JWT_SECRET go together (all set, or all empty)',
      );
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32)
      issue(
        'JWT_SECRET',
        'must be at least 32 characters (e.g. openssl rand -hex 32)',
      );
    if (
      env.ADMIN_PASSWORD_HASH &&
      !/^\$2[aby]\$\d\d\$/.test(env.ADMIN_PASSWORD_HASH)
    )
      issue(
        'ADMIN_PASSWORD_HASH',
        'must be a bcrypt hash (npm run hash-password), not the password',
      );
    // Deployed: refuse to start without production mode and some authentication.
    if (!env.RAILWAY_ENVIRONMENT?.trim()) return;
    if (env.NODE_ENV !== 'production')
      issue('NODE_ENV', 'must be production on Railway');
    if (env.API_TOKEN.length < 24 && !env.JWT_SECRET)
      issue(
        'API_TOKEN',
        'or the login (ADMIN_EMAIL, ADMIN_PASSWORD_HASH, JWT_SECRET) is required on Railway (API_TOKEN: at least 24 characters, e.g. openssl rand -hex 32): the API trades your account',
      );
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
