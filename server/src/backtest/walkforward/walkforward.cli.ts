import { relative } from 'node:path';
import { parseArgs } from 'node:util';
import { describeStrategies } from '../../strategies/strategy-registry.js';
import {
  openFile,
  resolvePeriod,
  resolveSymbols,
} from '../backtest-cli.helpers.js';
import { createBacktestApp } from '../cli-app.js';
import { ReportJobsService } from '../jobs/report-jobs.service.js';
import { formatAiSummary } from '../summary/ai-summary.format.js';
import { parseParamGrid } from '../sweep/param-grid.js';
import { SORT_KEYS, type SortKey } from '../sweep/sweep-report.js';
import { formatWalkForward } from './walkforward-report.js';

const USAGE = `Usage: npm run walkforward -- AAPL [options]

Walk-forward test: the honest version of a sweep. The period is cut into
windows; in each one the best setting is picked on the training part and then
traded on the next, unseen part. Only the unseen parts count in the result.

  --strategy <a,b>      one or more strategies, comma-separated (default: sma-crossover)
  --param key=values    values to try, repeatable (same syntax as npm run sweep):
                          fast=5,10,20   fast=5..30:5
  --train <duration>    training length: 6m, 12m, 2y, 90d (default: 12m)
  --test <duration>     test length, and how far each window moves (default: 3m)
  --anchored            training always starts at --from and grows
                        (default: rolling, a fixed-length window that slides)
  --sort <key>          how the best training run is picked:
                        ${SORT_KEYS.join(' | ')} (default: return-dd)
  --min-trades <n>      training runs need at least n closed trades to be picked (default: 0)
  --from / --to <date>  period, YYYY-MM-DD (default: the last 5 years)
  --timeframe <tf>      15Min | 1Hour | 1Day ... (default: 1Day)
  --cash, --slippage, --fee, --cash-yield, --news-gate   same as npm run backtest
  --html <file.html>    write the visual report to this file (instead of reports/...)
  --no-report           text only: don't write or open the visual report
  --no-ai               skip the AI summary (needs OPENAI_API_KEY in .env)

Examples:
  npm run walkforward -- AAPL --param fast=5..30:5 --param slow=20,50,100
  npm run walkforward -- SPY --strategy rsi-reversion --param period=7,14,21 --train 2y --test 6m

  Strategies:
${describeStrategies()}`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true, // --no-report, --no-ai
  options: {
    strategy: { type: 'string', default: 'sma-crossover' },
    symbols: { type: 'string' },
    param: { type: 'string', multiple: true, default: [] },
    train: { type: 'string', default: '12m' },
    test: { type: 'string', default: '3m' },
    anchored: { type: 'boolean', default: false },
    sort: { type: 'string', default: 'return-dd' },
    'min-trades': { type: 'string', default: '0' },
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

const symbols = resolveSymbols(values.symbols, positionals);
if (values.help || symbols.length === 0) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}
const sort = values.sort as SortKey;
if (!SORT_KEYS.includes(sort)) {
  console.error(`--sort must be one of: ${SORT_KEYS.join(', ')}`);
  process.exit(1);
}
const { from, to } = resolvePeriod(values.from, values.to, 5);
// --html <file>: that file; default: under reports/; --no-report: none.
const htmlPath = values.html ?? (values.report ? undefined : null);

const app = await createBacktestApp();
try {
  const job = await app.get(ReportJobsService).walkForward(
    {
      strategies: values.strategy
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      grid: parseParamGrid(values.param),
      symbols,
      timeframe: values.timeframe,
      from: new Date(from),
      to: new Date(to),
      train: values.train,
      test: values.test,
      anchored: values.anchored,
      sort,
      minTrades: Number(values['min-trades']) || 0,
      initialCash: Number(values.cash),
      slippageBps: Number(values.slippage),
      feePerShare: Number(values.fee),
      cashYieldPct: Number(values['cash-yield']),
      newsGateTone: Number(values['news-gate']) || 0,
    },
    { ai: values.ai, htmlPath },
  );
  console.log(formatWalkForward(job.result));
  if (job.ai) console.log(`\n${formatAiSummary(job.ai)}`);
  if (job.htmlPath) {
    console.log(
      `\nVisual report written to ${relative(process.cwd(), job.htmlPath)}`,
    );
    if (values.report) openFile(job.htmlPath);
  }
} catch (err) {
  console.error(`Walk-forward failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
