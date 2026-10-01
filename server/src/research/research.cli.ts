import { basename, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { planLabel } from '../backtest/plans/plan-menu.js';
import {
  openFile,
  resolvePeriod,
  resolveSymbols,
} from '../backtest/backtest-cli.helpers.js';
import { createBacktestApp } from '../backtest/cli-app.js';
import { REPORTS_DIR } from '../backtest/jobs/report-paths.js';
import { strategyNames } from '../strategies/strategy-registry.js';
import { experimentLine } from './research-prompts.js';
import { ResearchService } from './research.service.js';
import { BASKET_IDS, type BasketId } from './robustness/baskets.js';
import { formatRobustness } from './robustness/robustness-report.js';
import {
  RESEARCH_GOALS,
  type ResearchGoal,
  type ResearchSession,
} from './research.types.js';

const USAGE = `Usage: npm run research -- AAPL [options]

AI research agent: in rounds, an AI proposes walk-forward tests (strategies,
rule combinations, param ranges) from a fixed menu, the system runs and scores
them, and the AI learns from the results. The last part of the period is held
out: the best test runs on it once at the end, as the honest check.

  --goal <goal>         ${RESEARCH_GOALS.join(' | ')} (default: risk-adjusted)
  --rounds <n>          max rounds (default: 5)
  --tests <n>           tests per round (default: 3)
  --holdout <duration>  final stretch no test sees: 6m, 12m, 1y (default: 12m)
  --basket <id>         multi-symbol check of the best test: ${BASKET_IDS.join(' | ')} | none (default: megacaps)
  --strategy <a,b>      strategies the agent may use (default: all: ${strategyNames().join(', ')})
  --from / --to <date>  period, YYYY-MM-DD (default: the last 5 years)
  --timeframe <tf>      default: 1Day
  --cash, --slippage, --fee, --cash-yield, --news-gate   same as npm run backtest
  --no-report           don't open the visual report

Needs OPENAI_API_KEY in .env. A session makes ~1 AI call per round plus one
for the verdict, and takes a few minutes.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true,
  options: {
    symbols: { type: 'string' },
    goal: { type: 'string', default: 'risk-adjusted' },
    rounds: { type: 'string', default: '5' },
    tests: { type: 'string', default: '3' },
    holdout: { type: 'string', default: '12m' },
    strategy: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    timeframe: { type: 'string', default: '1Day' },
    cash: { type: 'string', default: '100000' },
    slippage: { type: 'string', default: '5' },
    fee: { type: 'string', default: '0' },
    'cash-yield': { type: 'string', default: '3' },
    'news-gate': { type: 'string', default: '0' },
    basket: { type: 'string', default: 'megacaps' },
    report: { type: 'boolean', default: true },
    help: { type: 'boolean', default: false },
  },
});

const symbols = resolveSymbols(values.symbols, positionals);
if (values.help || symbols.length === 0) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}
const goal = values.goal as ResearchGoal;
if (!RESEARCH_GOALS.includes(goal)) {
  console.error(`--goal must be one of: ${RESEARCH_GOALS.join(', ')}`);
  process.exit(1);
}
const basket = values.basket === 'none' ? null : (values.basket as BasketId);
if (basket && !BASKET_IDS.includes(basket)) {
  console.error(`--basket must be one of: ${BASKET_IDS.join(', ')}, none`);
  process.exit(1);
}
const { from, to } = resolvePeriod(values.from, values.to, 5);
const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

/** Prints what happened since the last update. */
function printer() {
  let rounds = 0;
  let experiments = 0;
  return (s: ResearchSession) => {
    for (const round of s.rounds.slice(rounds)) {
      console.log(`\nRound ${round.round}: ${round.thinking}`);
      round.rejected.forEach((x) => console.log(`  rejected: ${x}`));
      round.ideas.forEach((x) => console.log(`  idea: ${x}`));
    }
    for (const e of s.experiments.slice(experiments))
      console.log(`  ${experimentLine(e)}`);
    rounds = s.rounds.length;
    experiments = s.experiments.length;
  };
}

const app = await createBacktestApp();
try {
  console.log(
    `Researching ${symbols.join(', ')} (${from} → ${to}, last ${values.holdout} held out)...`,
  );
  const s = await app.get(ResearchService).runNow(
    {
      symbols,
      timeframe: values.timeframe,
      from: new Date(from),
      to: new Date(to),
      holdout: values.holdout,
      strategies: values.strategy
        ? values.strategy.split(',').map((x) => x.trim())
        : [],
      goal,
      rounds: Math.min(10, Math.max(1, Number(values.rounds) || 5)),
      testsPerRound: Math.min(5, Math.max(1, Number(values.tests) || 3)),
      initialCash: Number(values.cash),
      slippageBps: Number(values.slippage),
      feePerShare: Number(values.fee),
      cashYieldPct: Number(values['cash-yield']),
      newsGateTone: Number(values['news-gate']) || 0,
      basket,
    },
    printer(),
  );
  if (s.status === 'failed') throw new Error(s.error ?? 'unknown error');
  const champion = s.experiments.find((e) => e.id === s.championId);
  console.log(`\nStopped: ${s.stoppedBecause}. ${s.experiments.length} tests.`);
  if (champion)
    console.log(
      `Best on the research period: #${champion.id} ${planLabel(champion.plan)}`,
    );
  if (s.holdout) {
    const o = s.holdout.outcome;
    console.log(
      `Holdout (never seen): ${pct(o.returnPct)} vs buy & hold ${pct(o.holdReturnPct)}, max drawdown ${o.maxDrawdownPct.toFixed(1)}%, ${o.trades} trades, score ${s.holdout.score.toFixed(2)} (research ${champion?.score?.toFixed(2)})`,
    );
  }
  if (s.robustness) console.log(formatRobustness(s.robustness));
  console.log(
    s.candidate
      ? 'Passed every gate (holdout and multi-symbol check): a paper-trading candidate.'
      : 'Not a paper-trading candidate: it did not pass every gate.',
  );
  if (s.verdict) {
    console.log(`\nAI verdict (${s.verdict.model}): ${s.verdict.headline}`);
    s.verdict.points.forEach((p) => console.log(`  • ${p}`));
    console.log(`  Recommendation: ${s.verdict.recommendation}`);
  }
  if (s.reportUrl) {
    const path = join(REPORTS_DIR, basename(s.reportUrl));
    console.log(`\nVisual report written to ${relative(process.cwd(), path)}`);
    if (values.report) openFile(path);
  }
} catch (err) {
  console.error(`Research failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
