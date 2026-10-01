import type { BacktestResult } from '../backtest-engine.js';
import type { SweepResult, SweepRow } from '../sweep/sweep.service.js';

export const SUMMARY_SYSTEM_PROMPT = `You review backtest results of algorithmic trading strategies for a developer who is building and testing their own trading system.

Write for someone who is not a finance expert: plain words, short sentences, concrete numbers from the data. Judge what matters:
- Did it beat buy & hold over the same period? By how much?
- Risk vs reward: max drawdown compared to the return.
- Evidence strength: few closed trades means weak evidence; say so.
- How much of the result comes from positions still open at the end (unrealized).
- Costs, slippage and rejected orders if they matter. Idle cash earns interest (like a money-market fund); it is already included in the returns.
- For sweeps: are good results spread across many settings (robust) or one lucky setting (likely overfitting)?
- For portfolios: the whole vs its benchmark, which sleeves helped or hurt, whether the sleeves move alike (no diversification), and whether the portfolio stop helped.
- For walk-forward tests: only the unseen test periods count; judge the out-of-sample result vs buy & hold, the efficiency (out-of-sample vs training), and whether the chosen setting kept changing (unstable).

The recommendation is about the research, e.g.: test other periods or symbols, sweep parameters, compare with the other strategy, paper trade it, or drop the idea. Never tell the user to buy or sell any security and never give personal financial advice.

When the prompt includes a TEST MENU, also propose up to 3 next tests ("nextTests") that best answer the open questions, using only values from the menu. Prefer tests that check whether the idea is real (walk-forward, other strategies, combining rules with the "rules" strategy, e.g. adding a trend filter, a market filter (marketSma=200), a trailing or ATR stop) over fine-tuning one lucky value. Use [] if nothing is worth testing.

Respond with JSON only: {"headline": "one-sentence verdict", "points": ["2 to 4 short key points"], "recommendation": "1-2 sentences", "nextTests": [{"kind": "...", "strategies": ["..."], "params": {"name": "values"}, "train": "...", "test": "...", "anchored": false, "sort": "...", "minTrades": 0, "why": "..."}]}`;

const pct = (n: number | null) =>
  n === null ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const usd = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const day = (d?: Date) => d?.toISOString().slice(0, 10) ?? 'n/a';
const params = (p: Record<string, string>) =>
  Object.entries(p)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ') || 'defaults';

export interface SummaryContext {
  timeframe: string;
  params: Record<string, string>;
  slippageBps: number;
  cashYieldPct?: number;
}

export function backtestFacts(
  result: BacktestResult,
  ctx: SummaryContext,
): string {
  const m = result.metrics;
  const closed = result.fills.filter((f) => f.realizedPnl !== undefined);
  const realized = closed.reduce((sum, f) => sum + (f.realizedPnl ?? 0), 0);
  const unrealized = result.finalEquity - result.initialCash - realized;
  // Largest win among winners only, largest loss among losers only.
  const pnl = (f: (typeof closed)[number]) => f.realizedPnl ?? 0;
  const best = closed
    .filter((f) => pnl(f) > 0)
    .reduce<(typeof closed)[number] | undefined>(
      (a, f) => (!a || pnl(f) > pnl(a) ? f : a),
      undefined,
    );
  const worst = closed
    .filter((f) => pnl(f) < 0)
    .reduce<(typeof closed)[number] | undefined>(
      (a, f) => (!a || pnl(f) < pnl(a) ? f : a),
      undefined,
    );
  const rejections = new Map<string, number>();
  for (const r of result.rejections)
    rejections.set(r.error, (rejections.get(r.error) ?? 0) + 1);

  return [
    `Strategy: ${result.strategy} (params: ${params(ctx.params)})`,
    `Symbols: ${result.symbols.join(', ')} | timeframe ${ctx.timeframe} | ${day(result.from)} to ${day(result.to)} (${result.bars} bars)`,
    `Equity: ${usd(result.initialCash)} -> ${usd(result.finalEquity)}`,
    `Total return: ${pct(m.totalReturnPct)} | equal-weight buy & hold, same period: ${pct(m.buyAndHoldReturnPct)}`,
    `Max drawdown: ${m.maxDrawdownPct.toFixed(2)}%`,
    `Closed trades: ${m.trades} | win rate ${pct(m.winRatePct).replace('+', '')} | profit factor ${m.profitFactor?.toFixed(2) ?? 'n/a (no losing trades)'}`,
    `Realized P&L from closed trades: ${usd(realized)} | unrealized from open positions: ${usd(unrealized)}`,
    best
      ? `Largest win: ${usd(best.realizedPnl ?? 0)} (${best.symbol}, ${day(best.timestamp)})`
      : 'Largest win: none',
    worst
      ? `Largest loss: ${usd(worst.realizedPnl ?? 0)} (${worst.symbol}, ${day(worst.timestamp)})`
      : 'Largest loss: none',
    `Open at the end: ${result.openPositions.map((p) => `${p.qty} ${p.symbol}`).join(', ') || 'none'}`,
    `Costs: fees ${usd(m.totalFees)}, slippage ${ctx.slippageBps} bps per fill`,
    `Interest on idle cash: ${usd(result.interestEarned ?? 0)} at ${ctx.cashYieldPct ?? 0}% a year (included in the return)`,
    `Buys reduced to fit the cash at the fill price: ${result.fills.filter((f) => f.requestedQty !== undefined).length}`,
    `Rejected orders: ${result.rejections.length}${rejections.size ? ` (${[...rejections].map(([e, n]) => `${e}: ${n}`).join(', ')})` : ''}`,
  ].join('\n');
}

const rowLine = (r: SweepRow) =>
  `${r.strategy} ${params(r.params)}: return ${pct(r.metrics.totalReturnPct)}, max DD ${r.metrics.maxDrawdownPct.toFixed(1)}%, trades ${r.metrics.trades}, PF ${r.metrics.profitFactor?.toFixed(2) ?? 'n/a'}, ${r.openPositions ? 'position still open at the end' : 'flat at the end'}`;

export interface SweepSummaryContext {
  timeframe: string;
  slippageBps: number;
  feePerShare: number;
  cashYieldPct?: number;
}

export function sweepFacts(
  result: SweepResult,
  ctx: SweepSummaryContext,
): string {
  const hold = result.buyAndHoldReturnPct;
  const rows = [...result.rows].sort(
    (a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct,
  );
  const listed =
    rows.length <= 40
      ? rows.map(rowLine)
      : [
          ...rows.slice(0, 15).map(rowLine),
          `... ${rows.length - 20} more ...`,
          ...rows.slice(-5).map(rowLine),
        ];

  const perStrategy = [...new Set(rows.map((r) => r.strategy))].map(
    (strategy) => {
      const own = rows
        .filter((r) => r.strategy === strategy)
        .map((r) => r.metrics.totalReturnPct);
      const sorted = [...own].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const beat = hold === null ? 0 : own.filter((x) => x > hold).length;
      return `${strategy}: ${own.length} runs, median ${pct(median)}, ${own.filter((x) => x > 0).length} positive, ${beat} beat buy & hold, best ${pct(sorted.at(-1) ?? null)}, worst ${pct(sorted[0] ?? null)}`;
    },
  );

  return [
    `Parameter sweep on ${result.symbols.join(', ')} | timeframe ${ctx.timeframe} | ${day(result.from)} to ${day(result.to)} (${result.bars} bars)`,
    `Equal-weight buy & hold, same period: ${pct(hold)}`,
    `Runs: ${rows.length} (${result.skipped.length} invalid combinations skipped)`,
    `Costs in every run: slippage ${ctx.slippageBps} bps per fill, fees $${ctx.feePerShare} per share; idle cash earns ${ctx.cashYieldPct ?? 0}% a year (included)`,
    'Returns include positions still open at the end, valued at the last close.',
    'Per strategy:',
    ...perStrategy,
    'Runs, best return first:',
    ...listed,
  ].join('\n');
}
