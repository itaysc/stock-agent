import { parseArgs } from 'node:util';
import {
  resolvePeriod,
  resolveSymbols,
} from '../../backtest/backtest-cli.helpers.js';
import { createBacktestApp } from '../../backtest/cli-app.js';
import { SORT_KEYS } from '../../backtest/sweep/sweep-report.js';
import { RESEARCH_GOALS, type ResearchGoal } from '../research.types.js';
import {
  BASKET_IDS,
  type BasketId,
  basketSymbols,
  BASKETS,
} from './baskets.js';
import { formatRobustness } from './robustness-report.js';
import { RobustnessService } from './robustness.service.js';

const USAGE = `Usage: npm run robustness -- [SYMBOLS] [options]

Multi-symbol check: runs one walk-forward setup on each symbol of a basket, on
its own, and counts on how many it did better than just holding that symbol.
A setup that works on only one symbol is most likely luck.

  --basket <id>         ${BASKET_IDS.map((id) => `${id} (${BASKETS[id].description})`).join(', ')}
                        default: megacaps, or only the SYMBOLS given
  --strategy, --param, --train, --test, --anchored, --sort, --min-trades
                        the setup, same as npm run walkforward
  --goal <goal>         ${RESEARCH_GOALS.join(' | ')} (default: risk-adjusted)
  --from / --to <date>  default: the last 5 years
  --timeframe, --cash, --slippage, --fee, --cash-yield, --news-gate   as in npm run backtest

Example:
  npm run robustness -- --basket sectors --strategy rules --param breakout=20 --param marketSma=200,0 --param atrStop=2,3 --param trailingStop=0`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true,
  options: {
    basket: { type: 'string' },
    strategy: { type: 'string', default: 'sma-crossover' },
    param: { type: 'string', multiple: true, default: [] },
    train: { type: 'string', default: '12m' },
    test: { type: 'string', default: '3m' },
    anchored: { type: 'boolean', default: false },
    sort: { type: 'string', default: 'return-dd' },
    'min-trades': { type: 'string', default: '0' },
    goal: { type: 'string', default: 'risk-adjusted' },
    from: { type: 'string' },
    to: { type: 'string' },
    timeframe: { type: 'string', default: '1Day' },
    cash: { type: 'string', default: '100000' },
    slippage: { type: 'string', default: '5' },
    fee: { type: 'string', default: '0' },
    'cash-yield': { type: 'string', default: '3' },
    'news-gate': { type: 'string', default: '0' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
const extra = resolveSymbols(undefined, positionals);
const basket = (values.basket ?? (extra.length ? undefined : 'megacaps')) as
  BasketId | undefined;
if (basket && !BASKET_IDS.includes(basket)) {
  console.error(`--basket must be one of: ${BASKET_IDS.join(', ')}`);
  process.exit(1);
}
const goal = values.goal as ResearchGoal;
if (
  !RESEARCH_GOALS.includes(goal) ||
  !SORT_KEYS.includes(values.sort as never)
) {
  console.error(
    `--goal: ${RESEARCH_GOALS.join(', ')}; --sort: ${SORT_KEYS.join(', ')}`,
  );
  process.exit(1);
}
const { from, to } = resolvePeriod(values.from, values.to, 5);
const symbols = basketSymbols(basket, extra);

const app = await createBacktestApp();
try {
  console.log(`Checking on ${symbols.join(', ')} (${from} → ${to})...`);
  const result = await app.get(RobustnessService).run({
    plan: {
      kind: 'walkforward',
      strategies: values.strategy.split(',').map((s) => s.trim()),
      params: Object.fromEntries(
        values.param.map((p) => [
          p.slice(0, p.indexOf('=')),
          p.slice(p.indexOf('=') + 1),
        ]),
      ),
      train: values.train,
      test: values.test,
      anchored: values.anchored,
      sort: values.sort as (typeof SORT_KEYS)[number],
      minTrades: Number(values['min-trades']) || 0,
      why: '',
    },
    symbols,
    timeframe: values.timeframe,
    from: new Date(from),
    to: new Date(to),
    goal,
    initialCash: Number(values.cash),
    slippageBps: Number(values.slippage),
    feePerShare: Number(values.fee),
    cashYieldPct: Number(values['cash-yield']),
    newsGateTone: Number(values['news-gate']) || 0,
  });
  console.log(formatRobustness(result));
} catch (err) {
  console.error(`Multi-symbol check failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await app.close();
}
