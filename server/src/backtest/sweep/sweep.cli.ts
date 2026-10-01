import { writeFile } from 'node:fs/promises';
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
import { parseParamGrid } from './param-grid.js';
import {
  formatSweep,
  SORT_KEYS,
  type SortKey,
  sortRows,
  toCsv,
} from './sweep-report.js';

const USAGE = `Usage: npm run sweep -- AAPL MSFT [options]

Runs many backtests (every combination of the params) and ranks them.

  --strategy <a,b>      one or more strategies, comma-separated (default: sma-crossover)
  --param key=values    values to try, repeatable:
                          fast=10          one value
                          fast=5,10,20     a list
                          fast=5..30:5     a range with a step (5,10,...,30)
  --from / --to <date>  period, YYYY-MM-DD (default: the last 2 years)
  --timeframe <tf>      15Min | 1Hour | 1Day ... (default: 1Day)
  --sort <key>          ${SORT_KEYS.join(' | ')} (default: return)
  --top <n>             rows to show (default: 20)
  --min-trades <n>      hide runs with fewer closed trades (default: 0)
  --cash, --slippage, --fee, --cash-yield, --news-gate   same as npm run backtest
  --out <file.csv>      write every run as CSV
  --html <file.html>    write the visual report to this file (instead of reports/...)
  --no-report           text only: don't write or open the visual report
  --no-ai               skip the AI summary (needs OPENAI_API_KEY in .env)

By default the visual report (heatmap, scatter, top equity curves, table) is
written to reports/ and opened in your browser.

Examples:
  npm run sweep -- AAPL --param fast=5..30:5 --param slow=20,50,100
  npm run sweep -- AAPL MSFT --strategy sma-crossover,rsi-reversion   (compare at defaults)

  Strategies:
${describeStrategies()}`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true, // --no-report, --no-ai
  options: {
    strategy: { type: 'string', default: 'sma-crossover' },
    symbols: { type: 'string' },
    param: { type: 'string', multiple: true, default: [] },
    from: { type: 'string' },
    to: { type: 'string' },
    timeframe: { type: 'string', default: '1Day' },
    sort: { type: 'string', default: 'return' },
    top: { type: 'string', default: '20' },
    'min-trades': { type: 'string', default: '0' },
    cash: { type: 'string', default: '100000' },
    slippage: { type: 'string', default: '5' },
    fee: { type: 'string', default: '0' },
    'cash-yield': { type: 'string', default: '3' },
    'news-gate': { type: 'string', default: '0' },
    out: { type: 'string' },
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
const { from, to } = resolvePeriod(values.from, values.to);
const strategies = values.strategy
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// --html <file>: that file; default: under reports/; --no-report: none.
const htmlPath = values.html ?? (values.report ? undefined : null);

const app = await createBacktestApp();
try {
  const job = await app.get(ReportJobsService).sweep(
    {
      strategies,
      grid: parseParamGrid(values.param),
      symbols,
      timeframe: values.timeframe,
      from: new Date(from),
      to: new Date(to),
      initialCash: Number(values.cash),
      slippageBps: Number(values.slippage),
      feePerShare: Number(values.fee),
      cashYieldPct: Number(values['cash-yield']),
      newsGateTone: Number(values['news-gate']) || 0,
    },
    {
      ai: values.ai,
      sort,
      minTrades: Number(values['min-trades']) || 0,
      htmlPath,
    },
  );
  const { result, hidden } = job;
  console.log(formatSweep(result, sort, Number(values.top) || 20));
  if (job.ai) console.log(`\n${formatAiSummary(job.ai)}`);
  if (hidden > 0) {
    console.log(
      `(${hidden} runs with fewer than ${values['min-trades']} trades hidden)`,
    );
  }

  const best = sortRows(result.rows, sort)[0];
  if (best) {
    const params = Object.entries(best.params)
      .map(([k, v]) => ` --param ${k}=${v}`)
      .join('');
    console.log(
      `\nOpen the top result: npm run report -- ${symbols.join(' ')} --strategy ${best.strategy}` +
        `${params} --from ${from} --to ${to} --timeframe ${values.timeframe}`,
    );
  }
  if (values.out) {
    await writeFile(values.out, toCsv(job.all));
    console.log(`All runs written to ${values.out}`);
  }
  if (job.htmlPath) {
    console.log(
      `Visual report written to ${relative(process.cwd(), job.htmlPath)}`,
    );
    if (values.report) openFile(job.htmlPath);
  }
} catch (err) {
  console.error(`Sweep failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
