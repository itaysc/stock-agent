import { describePlanMenu, planLabel } from '../backtest/plans/plan-menu.js';
import { GOAL_TEXT, MIN_TRADES, ranked } from './research-score.js';
import type {
  Experiment,
  Outcome,
  ResearchRequest,
  ResearchSession,
} from './research.types.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
const day = (d: Date) => d.toISOString().slice(0, 10);
const params = (p: Record<string, string>) =>
  Object.entries(p)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');

export const AGENT_SYSTEM_PROMPT = `You are a quantitative research assistant. You run experiments to find a trading strategy setup that keeps working on data it was not tuned on, for a developer building their own trading system.

You work in rounds. Each round you see every result so far and propose new walk-forward tests from the TEST MENU. The system runs them on the research period and scores them. The last part of the history (the holdout) is hidden from you; the best test is run on it once at the end, as the final check.

How to research well:
- Start broad: try different families (trend following, mean reversion, breakouts, and combinations with the "rules" strategy) before fine-tuning one.
- Learn from the results and say why you test what you test. Examples: it avoids losses but misses rallies → loosen the exit, add a trailing stop instead of a fixed target, or add a trend filter to stay in; it trades too rarely → widen the entry or shorten the lookbacks; big drawdowns → add a stop-loss, a trailing stop or a trend filter; good in training but poor on unseen data (low efficiency) → simpler rules, fewer values.
- The "rules" strategy combines building blocks: every entry rule that is on must hold on the same bar, and any exit rule that is on sells. Combine at most one "signal" entry (crossover, breakout, MACD cross) with state entries (trend, RSI, dip, Bollinger, volume, market filter). Useful blocks: marketSma (only buy while SPY is above its average, e.g. 200; marketExit=1 also sells when it falls below), atrStop (a trailing stop in units of the stock's own volatility, e.g. 2-4), volumeRatio (only act on heavy volume), volMax / volExit (only buy while the market is calm, e.g. volMax=20; sell when it gets turbulent), newsFilter + newsMin / newsExit (headline tone of the last newsDays days, -1..+1: only buy on positive news, sell on bad news), earningsAvoid / earningsExit (stay out around earnings reports), surpriseMin (buy after a report that beat estimates: post-earnings drift). Information blocks make sense for single stocks; index ETFs have no earnings and little news. The "momentum-rotation" strategy ranks the session's symbols and holds the top N (only when the session has several symbols, e.g. a group of ETFs; set topN below the number of symbols, and safeLast=1 only if the last symbol is a safe asset like TLT); its check is run on other groups of symbols instead of symbol by symbol. Turn off rules you don't want by setting them to 0 (breakout and trailingStop are on by default).
- Walk-forward picks the best setting in each training window from the values you give, so give a small sensible range (2-4 values for 1-3 params), not a single value and not a huge grid.
- Beware of luck: the more tests, the more likely one wins by chance. Prefer simple setups that work across windows (stable settings, many trades, decent efficiency) over a complex one with a slightly higher score. Fewer than ${MIN_TRADES} trades is weak evidence.
- Never repeat a test that already ran. Fix rejected proposals using the reason given.
- Set "done": true when more tests are unlikely to find something meaningfully better.
- "ideas": optional, 0-3 short ideas for NEW building blocks or strategies that are not in the menu but the results suggest (the developer may add them).
This is research: never tell anyone to buy or sell a security.

Respond with JSON only: {"thinking": "2-4 sentences: what you learned and why you chose the next tests", "tests": [{"kind": "walkforward", "strategies": ["..."], "params": {"name": "values"}, "train": "...", "test": "...", "anchored": false, "sort": "...", "minTrades": 0, "why": "..."}], "done": false, "ideas": []}`;

function outcomeText(o: Outcome): string {
  const pick = o.latestPick
    ? `${o.latestPick.strategy} ${params(o.latestPick.params)}`
    : 'none';
  return (
    `unseen ${pct(o.returnPct)} vs buy & hold ${pct(o.holdReturnPct)} (annualized ${pct(o.annualPct)} vs ${pct(o.holdAnnualPct)}), ` +
    `max drawdown ${o.maxDrawdownPct.toFixed(1)}% (hold ${o.holdMaxDrawdownPct.toFixed(1)}%), ` +
    `${o.trades} trades, win ${pct(o.winRatePct).replace('+', '')}, profit factor ${o.profitFactor?.toFixed(2) ?? 'n/a'}, ` +
    `efficiency ${o.efficiencyPct === null ? 'n/a' : `${o.efficiencyPct.toFixed(0)}%`}, ` +
    `${o.distinctSettings} settings used in ${o.windows} windows, latest pick: ${pick}`
  );
}

export function experimentLine(e: Experiment): string {
  const head = `#${e.id} (round ${e.round}) ${planLabel(e.plan)}`;
  if (e.error) return `${head} → failed: ${e.error}`;
  if (!e.outcome) return `${head} → not run`;
  return `${head} → score ${e.score?.toFixed(2)}${e.weak ? ' (weak: few trades)' : ''} | ${outcomeText(e.outcome)}`;
}

/** The research period's buy & hold, for context. */
export interface Baseline {
  returnPct: number | null;
  annualPct: number | null;
  maxDrawdownPct: number;
}

export function roundPrompt(
  session: ResearchSession,
  round: number,
  baseline: Baseline,
  /** e.g. which data sources are unavailable in this session. */
  notes: string[] = [],
): string {
  const r: ResearchRequest = session.request;
  const done = ranked(session.experiments);
  const failed = session.experiments.filter((e) => e.error);
  const lastRejected = session.rounds.at(-1)?.rejected ?? [];
  return [
    `Symbols: ${r.symbols.join(', ')} | timeframe ${r.timeframe} | research period ${day(r.from)} to ${day(session.researchTo)} (the ${r.holdout} after it are held out)`,
    `Goal (the score): ${GOAL_TEXT[r.goal]}.`,
    `Buy & hold over the research period: ${pct(baseline.returnPct)} (annual ${pct(baseline.annualPct)}), max drawdown ${baseline.maxDrawdownPct.toFixed(1)}%.`,
    `Costs: slippage ${r.slippageBps} bps per fill, fee $${r.feePerShare} per share. Idle cash earns ${r.cashYieldPct}% a year (so staying out of the market isn't free money lost).`,
    `Round ${round} of ${r.rounds}: propose up to ${r.testsPerRound} tests. Allowed strategies: ${r.strategies.join(', ')}.`,
    ...notes,
    '',
    done.length || failed.length
      ? [
          'EXPERIMENTS SO FAR (best first):',
          ...done.map(experimentLine),
          ...failed.map(experimentLine),
        ].join('\n')
      : 'No experiments yet: start broad.',
    ...(lastRejected.length
      ? [
          '',
          'REJECTED LAST ROUND (fix or drop):',
          ...lastRejected.map((x) => `- ${x}`),
        ]
      : []),
    '',
    describePlanMenu(['walkforward']),
  ].join('\n');
}

export const VERDICT_SYSTEM_PROMPT = `You review an automated strategy research session for a developer who is not a finance expert. Plain words, short sentences, concrete numbers.

Judge honestly:
- Did the best setup found hold up on the holdout (the period no test saw)? Compare it with buy & hold there and with its research result. Only the chosen test was run on the holdout; the other tests only ran on the research period.
- Use the numbers exactly as given, and say whether a number is a total or an annualized return.
- How many tests were tried: the best of many tests is flattered by luck, so a holdout result much worse than the research result means it was mostly luck.
- Evidence: number of trades, stability of the picked settings.
- The multi-symbol check (the same setup run on each symbol of a basket, on its own): a setup that is better than holding on only a few symbols is most likely luck. The session is a paper-trading candidate only if the holdout AND this check pass.
- What to research next (other symbols, periods, building blocks), or to drop the idea. Paper trading is an option only when the holdout clearly confirms.
Never tell anyone to buy or sell a security and never give personal financial advice.

Respond with JSON only: {"headline": "one-sentence verdict", "points": ["2 to 4 short key points"], "recommendation": "1-2 sentences"}`;

export function verdictPrompt(session: ResearchSession): string {
  const r = session.request;
  const champion = session.experiments.find((e) => e.id === session.championId);
  const top = ranked(session.experiments).slice(0, 5);
  return [
    `Research on ${r.symbols.join(', ')} (${r.timeframe}), goal: ${GOAL_TEXT[r.goal]}.`,
    `${session.experiments.length} tests in ${session.rounds.length} rounds on ${day(r.from)} to ${day(session.researchTo)}; stopped because: ${session.stoppedBecause}.`,
    '',
    'Top tests on the research period:',
    ...top.map(experimentLine),
    '',
    champion
      ? `Chosen: #${champion.id} ${planLabel(champion.plan)}`
      : 'No test ran.',
    session.holdout
      ? `HOLDOUT (${day(session.holdout.outcome.from)} to ${day(session.holdout.outcome.to)}, never seen during research): score ${session.holdout.score.toFixed(2)} | ${outcomeText(session.holdout.outcome)}`
      : 'Holdout: not run.',
    robustnessText(session),
    `Paper-trading candidate (passed every gate): ${session.candidate ? 'yes' : 'no'}`,
  ].join('\n');
}

function robustnessText(session: ResearchSession): string {
  const rb = session.robustness;
  if (!rb) return 'Multi-symbol check: not run.';
  const rows = rb.rows.map((x) =>
    x.outcome
      ? `${x.symbol} ${pct(x.outcome.returnPct)} vs hold ${pct(x.outcome.holdReturnPct)} (score ${x.score?.toFixed(2)})`
      : `${x.symbol} failed`,
  );
  return `Multi-symbol check (${day(rb.from)} to ${day(rb.to)}): ${rb.summary.verdict} Median score ${rb.summary.medianScore?.toFixed(2) ?? 'n/a'}. Per symbol: ${rows.join('; ')}`;
}
