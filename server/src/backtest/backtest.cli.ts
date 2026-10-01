import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { parseArgs } from 'node:util';
import { describeStrategies } from '../strategies/strategy-registry.js';
import {
  openFile,
  resolvePeriod,
  resolveSymbols,
} from './backtest-cli.helpers.js';
import { formatReport } from './backtest-report.js';
import { createBacktestApp } from './cli-app.js';
import { ReportJobsService } from './jobs/report-jobs.service.js';
import { formatRunStatus } from './runs/run-status.format.js';
import { formatAiSummary } from './summary/ai-summary.format.js';

const USAGE = `Usage: npm run report -- AAPL MSFT [options]        (backtest + open the visual report)
       npm run backtest -- AAPL MSFT [options]      (text summary only)

  --from / --to <date>  period, YYYY-MM-DD (default: the last 2 years)

  --strategy <name>     default: sma-crossover (strategies and their params below)
  --timeframe <tf>      15Min | 1Hour | 1Day ... (default: 1Day)
  --param key=value     strategy param, repeatable (e.g. --param fast=10 --param slow=30)
  --cash <usd>          starting cash (default: 100000)
  --slippage <bps>      slippage per fill in basis points (default: 5)
  --fee <usd>           commission per share (default: 0)
  --cash-yield <pct>    yearly interest on idle cash, like a money-market fund (default: 3)
  --news-gate <tone>    skip a buy when the headlines before its open average this negative
                        or worse, e.g. 0.3 (default: 0 = off)
  --out <file.json>     also write the full result as JSON
  --html <file.html>    also write a visual report (charts + trades)
  --report              write the visual report to reports/ and open it in the browser
  --no-ai               skip the AI summary (needs OPENAI_API_KEY in .env)
  --fresh               re-run even if this exact test is saved in the run history

  Strategies:
${describeStrategies()}`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true, // --no-ai
  options: {
    strategy: { type: 'string', default: 'sma-crossover' },
    symbols: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    timeframe: { type: 'string', default: '1Day' },
    param: { type: 'string', multiple: true, default: [] },
    cash: { type: 'string', default: '100000' },
    slippage: { type: 'string', default: '5' },
    fee: { type: 'string', default: '0' },
    'cash-yield': { type: 'string', default: '3' },
    'news-gate': { type: 'string', default: '0' },
    out: { type: 'string' },
    html: { type: 'string' },
    report: { type: 'boolean', default: false },
    ai: { type: 'boolean', default: true },
    fresh: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

const symbols = resolveSymbols(values.symbols, positionals);
if (values.help || symbols.length === 0) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}
const { from, to } = resolvePeriod(values.from, values.to);
// --html <file>: that file; --report: default path under reports/; otherwise none.
const htmlPath = values.html ?? (values.report ? undefined : null);

const params = Object.fromEntries(
  values.param.map((pair) => {
    const [key, ...rest] = pair.split('=');
    return [key, rest.join('=')];
  }),
);

const app = await createBacktestApp();
try {
  const job = await app.get(ReportJobsService).backtest(
    {
      strategy: values.strategy,
      symbols,
      params,
      timeframe: values.timeframe,
      from: new Date(from),
      to: new Date(to),
      initialCash: Number(values.cash),
      slippageBps: Number(values.slippage),
      feePerShare: Number(values.fee),
      cashYieldPct: Number(values['cash-yield']),
      newsGateTone: Number(values['news-gate']) || 0,
    },
    { fresh: values.fresh, ai: values.ai, htmlPath },
  );
  const { result } = job.run;
  console.log(`${formatRunStatus(job.run.status)}\n`);
  console.log(formatReport(result));
  if (job.ai)
    console.log(`\n${formatAiSummary(job.ai, { saved: job.aiSaved })}`);
  if (values.out) {
    await writeFile(values.out, JSON.stringify(result, null, 2));
    console.log(`\nFull result written to ${values.out}`);
  }
  if (job.htmlPath) {
    console.log(
      `\nVisual report written to ${relative(process.cwd(), job.htmlPath)}`,
    );
    if (values.report) openFile(job.htmlPath);
  }
} catch (err) {
  console.error(`Backtest failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
