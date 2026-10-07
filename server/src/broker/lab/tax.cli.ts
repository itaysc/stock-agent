import { resolve } from 'node:path';
import { createBacktestApp } from '../../backtest/cli-app.js';
import { runBacktest } from '../../backtest/backtest-engine.js';
import { pointInTime } from '../../strategies/rotation/rotation-universe.js';
import { createStrategy } from '../../strategies/strategy-registry.js';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import { INDEX_PARAMS, INDEX_SYMBOLS, profileById } from '../profiles.js';
import { SAFE_ASSET } from '../universe.js';
import { curveStats, type Curve } from './profile-stats.js';
import { sp500Top } from './sp500-universe.js';
import { yahooDaily } from './yahoo-history.js';

/**
 * The profiles before and after Israeli capital gains tax (25% of each year's
 * net realized gains, losses carried forward, the rest paid on selling at the
 * end), against holding SPY and paying the tax once at the end. One
 * continuous run each from 2007 (no walk-forward: its window ends would sell
 * everything every 6 months and distort the tax), the broker's own settings.
 *   node dist/broker/lab/tax.cli.js
 */
const TAX = 25;
const from = new Date('2005-01-01');
const startAt = new Date('2007-01-03');
const to = new Date();
const cache = resolve(process.cwd(), '.cache/yahoo');
const app = await createBacktestApp();
const u = await sp500Top(
  50,
  from,
  to,
  resolve(process.cwd(), '.cache/sp500/sp500_ticker_start_end.csv'),
  cache,
);
const bars: Record<string, StrategyBar[]> = await yahooDaily(
  [...u.symbols, SAFE_ASSET, ...INDEX_SYMBOLS],
  from,
  to,
  cache,
);
const stocks = [...u.symbols, SAFE_ASSET];

interface Run {
  curve: Curve[];
  final: number;
  afterTax: number;
  taxPaid: number;
}
/** One sleeve with `cash`, continuously from startAt, taxed at `tax`%. */
function sleeve(
  kind: 'stocks' | 'index',
  params: Record<string, string>,
  cash: number,
  tax: number,
): Run {
  const symbols = kind === 'stocks' ? stocks : INDEX_SYMBOLS;
  pointInTime.set(kind === 'stocks' ? u.allowed : null);
  const r = runBacktest(
    createStrategy('momentum-rotation', symbols, params),
    Object.fromEntries(symbols.map((s) => [s, bars[s] ?? []])),
    {
      initialCash: cash,
      slippageBps: 5,
      feePerShare: 0,
      cashYieldPct: 3,
      taxRatePct: tax,
    },
    { startAt, market: { SPY: bars.SPY } },
  );
  return {
    curve: r.equityCurve,
    final: r.finalEquity,
    afterTax: r.afterTaxEquity ?? r.finalEquity,
    taxPaid: r.taxPaid ?? 0,
  };
}
/** Several sleeves as one account (each taxed on its own: a bit pessimistic, losses don't cross). */
const combine = (runs: Run[]): Run => ({
  curve: runs[0].curve.map((p, i) => ({
    timestamp: p.timestamp,
    equity: runs.reduce((n, r) => n + (r.curve[i]?.equity ?? 0), 0),
  })),
  final: runs.reduce((n, r) => n + r.final, 0),
  afterTax: runs.reduce((n, r) => n + r.afterTax, 0),
  taxPaid: runs.reduce((n, r) => n + r.taxPaid, 0),
});

const START = 10_000;
const momentum = (id: string, extra: Record<string, string> = {}) => {
  const p = profileById(id);
  if (!p) throw new Error(`no profile ${id}`);
  return { ...p.sleeves[0].params, ...extra };
};
const versions: Array<[string, (tax: number) => Run]> = [
  [
    'Aggressive (weekly)',
    (t) => sleeve('stocks', momentum('aggressive'), START, t),
  ],
  [
    'Aggressive + tranches',
    (t) =>
      sleeve('stocks', momentum('aggressive', { tranches: '5' }), START, t),
  ],
  [
    'Balanced (tranches, now)',
    (t) => sleeve('stocks', momentum('balanced'), START, t),
  ],
  [
    'Balanced weekly',
    (t) => sleeve('stocks', momentum('balanced', { tranches: '0' }), START, t),
  ],
  [
    'Careful (now)',
    (t) =>
      combine([
        sleeve('stocks', momentum('careful'), START / 2, t),
        sleeve('index', INDEX_PARAMS, START / 2, t),
      ]),
  ],
];

const years = (to.getTime() - startAt.getTime()) / (365.25 * 86_400_000);
const cagr = (end: number) => ((end / START) ** (1 / years) - 1) * 100;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
console.log(
  `${'version'.padEnd(26)} before tax   after tax   tax paid along the way   worst drop`,
);
// SPY held: no tax until the end, then 25% of the whole gain.
const spy = bars.SPY.filter((b) => b.timestamp >= startAt);
const spyEnd = START * ((spy.at(-1)?.close ?? 0) / spy[0].close);
const spyAfter = spyEnd - Math.max(0, spyEnd - START) * (TAX / 100);
const spyDd = curveStats(
  spy.map((b) => ({ timestamp: b.timestamp, equity: b.close })),
);
console.log(
  `${'SPY, held (tax at the end)'.padEnd(26)} ${pct(cagr(spyEnd)).padStart(7)}/yr  ${pct(cagr(spyAfter)).padStart(7)}/yr   $0`.padEnd(
    80,
  ) + `   -${spyDd.maxDrawdownPct.toFixed(1)}%`,
);
for (const [name, run] of versions) {
  const pre = run(0);
  const post = run(TAX);
  console.log(
    `${name.padEnd(26)} ${pct(cagr(pre.final)).padStart(7)}/yr  ${pct(cagr(post.afterTax)).padStart(7)}/yr   $${Math.round(post.taxPaid).toLocaleString('en-US')} on $${START.toLocaleString('en-US')}`.padEnd(
      80,
    ) + `   -${curveStats(post.curve).maxDrawdownPct.toFixed(1)}%`,
  );
}
await app.close();
