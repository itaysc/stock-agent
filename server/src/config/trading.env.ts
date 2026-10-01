import { z } from 'zod';

const usd = (fallback: number) =>
  z.coerce.number().positive().default(fallback);

const liveStrategySchema = z.object({
  strategy: z.string().min(1),
  symbols: z.array(z.string().min(1)).min(1),
  /** Minute or hour bars: 1Min, 5Min, 15Min, 1Hour, ... */
  timeframe: z.string().default('1Min'),
  params: z.record(z.string(), z.coerce.string()).default({}),
});

export type LiveStrategyConfig = z.infer<typeof liveStrategySchema>;

/** Risk limits, live strategies and the LLM. Merged into the main env schema. */
export const tradingEnv = {
  // OpenAI, for the AI summaries of backtests/sweeps. Empty key = summaries off.
  OPENAI_API_KEY: z.string().default(''),
  // Low-cost tier of OpenAI's newest family ($0.20 / $1.20 per 1M tokens in/out).
  OPENAI_MODEL: z.string().min(1).default('gpt-5.6-luna'),

  // Checked before every order that adds risk (reducing sells are always allowed).
  RISK_MAX_POSITION_VALUE: usd(10_000),
  RISK_MAX_TOTAL_EXPOSURE: usd(50_000),
  RISK_MAX_DAILY_LOSS: usd(1_000),
  // Checked for every order: caps a runaway strategy.
  RISK_MAX_ORDERS_PER_MINUTE: z.coerce.number().int().positive().default(10),

  // JSON array of strategies the server runs live, e.g.
  // [{"strategy":"sma-crossover","symbols":["AAPL"],"timeframe":"15Min","params":{"fast":"10"}}]
  LIVE_STRATEGIES: z
    .string()
    .default('[]')
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'must be a JSON array' });
        return z.NEVER;
      }
    })
    .pipe(z.array(liveStrategySchema)),
  // Strategies refuse to run on a live (real money) account unless this is true.
  STRATEGIES_ALLOW_LIVE: z.stringbool().default(false),
  // Paper deployments (daily strategies on the paper account, see src/paper/).
  PAPER_TRADING_ENABLED: z.stringbool().default(true),
  // How often the runner checks for completed daily bars and order fills.
  PAPER_TRADING_POLL_MINUTES: z.coerce.number().int().min(1).default(15),
  // The autopilot's schedule check (it only acts when turned on in the Lab).
  AUTOPILOT_SCHEDULER_ENABLED: z.stringbool().default(true),
  // Optional: POST {"text": "..."} here on every autopilot decision (e.g. a Slack incoming webhook).
  // Optional: earnings dates and surprises (free key at alphavantage.co) for the earnings blocks.
  ALPHAVANTAGE_API_KEY: z.string().default(''),
  // SEC EDGAR asks for a contact in the User-Agent, e.g. "stock-invest you@example.com". Empty = filings check off.
  SEC_USER_AGENT: z.string().default(''),
  NOTIFY_WEBHOOK_URL: z.union([z.literal(''), z.url()]).default(''),
};
