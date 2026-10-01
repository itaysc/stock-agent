import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { parseArgs } from 'node:util';
import { describeStrategies } from '../../strategies/strategy-registry.js';
import { openFile, resolvePeriod } from '../backtest-cli.helpers.js';
import { createBacktestApp } from '../cli-app.js';
import { formatAiSummary } from '../summary/ai-summary.format.js';
import { PortfolioJobsService } from './portfolio-jobs.service.js';
import { formatPortfolio } from './portfolio-report.js';
import type { Sleeve } from './portfolio.types.js';
import { parseSleeve } from './sleeve-spec.js';

const USAGE = `Usage: npm run portfolio -- --sleeve "40 rules AAPL,MSFT breakout=20" --sleeve "30 rsi-reversion SPY" [options]

Portfolio backtest: several strategies, each with fixed settings, its own
symbols and share of the money, run together on one clock. Whatever no sleeve
gets stays in cash (earning interest).

  --sleeve "<spec>"     WEIGHT STRATEGY SYMBOLS [param=value ...], repeatable
  --file <file.json>    or: {"sleeves": [{"weightPct": 40, "strategy": "rules",
                          "symbols": ["AAPL"], "params": {"breakout": "20"}}]}
  --max-drawdown <pct>  sell everything when the portfolio is this % below its peak (default: 0 = off)
  --cooldown <days>     then no new buys for this many days (default: 20)
  --from / --to <date>  default: the last 5 years
  --timeframe, --cash, --slippage, --fee, --cash-yield, --news-gate   as in npm run backtest
  --html <file.html>    report path (default: reports/...); --no-report: text only; --no-ai

  Strategies:
${describeStrategies()}`;

const { values } = parseArgs({
  allowNegative: true,
  options: {
    sleeve: { type: 'string', multiple: true, default: [] },
    file: { type: 'string' },
    'max-drawdown': { type: 'string', default: '0' },
    cooldown: { type: 'string', default: '20' },
    from: { type: 'string' },
    to: { type: 'string' },
    timeframe: { type: 'string', default: '1Day' },
    cash: { type: 'string', default: '100000' },
    slippage: { type: 'string', default: '5' },
    fee: { type: 'string', default: '0' },
    'cash-yield': { type: 'string', default: '3' },
    'news-gate': { type: 'string', default: '0' },
    html: { type: 'string' },
    report: { type: 'boolean', default: true },
    ai: { type: 'boolean', default: true },
    help: { type: 'boolean', default: false },
  },
});

let sleeves: Sleeve[] = [];
try {
  sleeves = values.sleeve.map(parseSleeve);
  if (values.file) {
    const file = JSON.parse(await readFile(values.file, 'utf8')) as {
      sleeves?: Sleeve[];
    };
    sleeves.push(...(file.sleeves ?? []));
  }
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
if (values.help || sleeves.length === 0) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}
const { from, to } = resolvePeriod(values.from, values.to, 5);
const htmlPath = values.html ?? (values.report ? undefined : null);

const app = await createBacktestApp();
try {
  const job = await app.get(PortfolioJobsService).run(
    {
      sleeves,
      risk: {
        maxDrawdownPct: Number(values['max-drawdown']) || 0,
        cooldownDays: Number(values.cooldown) || 0,
      },
      timeframe: values.timeframe,
      from: new Date(from),
      to: new Date(to),
      initialCash: Number(values.cash),
      slippageBps: Number(values.slippage),
      feePerShare: Number(values.fee),
      cashYieldPct: Number(values['cash-yield']),
      newsGateTone: Number(values['news-gate']) || 0,
    },
    { ai: values.ai, htmlPath },
  );
  console.log(formatPortfolio(job.result));
  if (job.ai) console.log(`\n${formatAiSummary(job.ai)}`);
  if (job.htmlPath) {
    console.log(
      `\nVisual report written to ${relative(process.cwd(), job.htmlPath)}`,
    );
    if (values.report) openFile(job.htmlPath);
  }
} catch (err) {
  console.error(`Portfolio failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
