import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createBacktestApp } from '../../backtest/cli-app.js';
import { WalkForwardService } from '../../backtest/walkforward/walkforward.service.js';
import { pointInTime } from '../../strategies/rotation/rotation-universe.js';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import { DEFAULT_PARAMS, SAFE_ASSET } from '../universe.js';
import { curveStats, mixedCurve, type Curve } from './profile-stats.js';
import { sp500Top } from './sp500-universe.js';
import { yahooDaily } from './yahoo-history.js';

/**
 * Ideas beyond the 50 stocks, the same fair way as profiles.cli (walk-forward
 * 2y/6m, Yahoo prices, from 2005):
 *   --part assets   momentum across asset classes (stocks, bonds, gold, ...), alone and mixed with the broker
 *   --part universe the broker picking from the 100 or 200 most-traded S&P 500 stocks instead of 50
 *   node dist/broker/lab/assets.cli.js --part assets
 */
const { values } = parseArgs({
  options: {
    from: { type: 'string', default: '2005-01-01' },
    part: { type: 'string', default: 'assets' },
  },
});
const from = new Date(values.from);
const to = new Date();
const cache = resolve(process.cwd(), '.cache/yahoo');
const spans = resolve(process.cwd(), '.cache/sp500/sp500_ticker_start_end.csv');
const app = await createBacktestApp();
type Bars = Record<string, StrategyBar[]>;

async function curve(
  symbols: string[],
  params: Record<string, string>,
  bars: Bars,
  allowed: ((s: string, at: Date) => boolean) | null,
): Promise<Curve[]> {
  pointInTime.set(allowed);
  const r = await app.get(WalkForwardService).run(
    {
      strategies: ['momentum-rotation'],
      grid: Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, [v]]),
      ),
      symbols,
      timeframe: '1Day',
      from,
      to,
      train: '2y',
      test: '6m',
      sort: 'return-dd',
      initialCash: 10_000,
      slippageBps: 5,
      feePerShare: 0,
      cashYieldPct: 3,
    },
    Object.fromEntries(symbols.map((x) => [x, bars[x] ?? []])),
    { SPY: bars.SPY },
  );
  return r.equityCurve;
}

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
function show(name: string, c: Curve[]) {
  const s = curveStats(c);
  console.log(
    `${name.padEnd(40)} ${pct(s.annualPct).padStart(7)}/yr  worst drop -${s.maxDrawdownPct.toFixed(1)}%  worst year ${s.worstYear.year} ${pct(s.worstYear.pct)}  (${s.from.getUTCFullYear()}-${s.to.getUTCFullYear()})`,
  );
}

/** The broker's stocks part on the n most-traded S&P 500 members (point in time). */
async function broker(n: number, extra: Record<string, string> = {}) {
  const u = await sp500Top(n, from, to, spans, cache);
  const symbols = [...u.symbols, SAFE_ASSET];
  const bars = await yahooDaily([...symbols, 'SPY'], from, to, cache);
  return curve(symbols, { ...DEFAULT_PARAMS, ...extra }, bars, u.allowed);
}

const ROTATION = {
  skipRecent: '0',
  absMomentum: '1',
  safeLast: '1',
  volWeight: '0',
  band: '2',
  fractional: '1',
};
// The last symbol is where the money goes when nothing is rising.
const ASSETS: Array<{
  name: string;
  symbols: string[];
  params: Record<string, string>;
}> = [
  {
    name: 'GEM: US or world stocks, else bonds',
    symbols: ['SPY', 'EFA', 'AGG'],
    params: { ...ROTATION, lookback: '252', topN: '1', rebalanceDays: '21' },
  },
  ...[1, 2, 3].map((n) => ({
    name: `Assets: best ${n} of 6 (12 months)`,
    symbols: ['SPY', 'EFA', 'EEM', 'TLT', 'GLD', 'VNQ', 'SHV'],
    params: {
      ...ROTATION,
      lookback: '252',
      topN: String(n),
      rebalanceDays: '21',
    },
  })),
  {
    name: 'Assets: best 3 of 6 (6 months)',
    symbols: ['SPY', 'EFA', 'EEM', 'TLT', 'GLD', 'VNQ', 'SHV'],
    params: { ...ROTATION, lookback: '126', topN: '3', rebalanceDays: '21' },
  },
];

if (values.part === 'universe') {
  for (const n of [50, 100, 200]) {
    show(`Aggressive, top ${n} stocks`, await broker(n));
    show(`Balanced, top ${n} stocks`, await broker(n, { marketFilter: '200' }));
  }
} else {
  const aggressive = await broker(50);
  const balanced = await broker(50, { marketFilter: '200' });
  const etfs = [...new Set(ASSETS.flatMap((a) => a.symbols))];
  const bars = await yahooDaily(etfs, from, to, cache);
  const spy = curveStats(
    bars.SPY.map((b) => ({ timestamp: b.timestamp, equity: b.close })),
  );
  console.log(
    `SPY ${pct(spy.annualPct)}/yr, worst drop -${spy.maxDrawdownPct.toFixed(1)}% (${spy.from.getUTCFullYear()}-${spy.to.getUTCFullYear()})\n`,
  );
  show('Aggressive now', aggressive);
  show('Balanced now', balanced);
  for (const a of ASSETS) {
    const c = await curve(a.symbols, a.params, bars, null);
    console.log('');
    show(a.name, c);
    for (const [label, base] of [
      ['Aggressive', aggressive],
      ['Balanced', balanced],
    ] as const)
      for (const w of [0.7, 0.5])
        show(
          `  ${Math.round(w * 100)}% ${label} + ${Math.round((1 - w) * 100)}% this`,
          mixedCurve([
            { curve: base, weight: w },
            { curve: c, weight: 1 - w },
          ]),
        );
  }
}
await app.close();
