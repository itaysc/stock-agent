import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createBacktestApp } from '../../backtest/cli-app.js';
import { WalkForwardService } from '../../backtest/walkforward/walkforward.service.js';
import { fundamentals } from '../../strategies/rotation/rotation-fundamentals.js';
import { pointInTime } from '../../strategies/rotation/rotation-universe.js';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import { DEFAULT_PARAMS, SAFE_ASSET } from '../universe.js';
import { fundamentalsFrom } from './fundamentals.js';
import { curveStats, type Curve } from './profile-stats.js';
import { secFacts } from './sec-facts.js';
import { sp500Top } from './sp500-universe.js';
import { yahooDaily } from './yahoo-history.js';

/**
 * Momentum mixed with value and quality from the companies' SEC reports, as
 * public on each day (from 2009, when the SEC's structured data starts).
 *   node dist/broker/lab/fundamentals.cli.js --part fetch      (once: downloads and caches)
 *   node dist/broker/lab/fundamentals.cli.js --profile a       (Aggressive; b = Balanced)
 */
const { values } = parseArgs({
  options: {
    part: { type: 'string', default: 'run' },
    profile: { type: 'string', default: 'a' },
  },
});
const from = new Date('2009-01-01');
const to = new Date();
const app = await createBacktestApp();
const u = await sp500Top(
  50,
  from,
  to,
  resolve(process.cwd(), '.cache/sp500/sp500_ticker_start_end.csv'),
  resolve(process.cwd(), '.cache/yahoo'),
);
const { facts, missing } = await secFacts(
  u.symbols,
  resolve(process.cwd(), '.cache/sec'),
  app.get(ConfigService).get<string>('SEC_USER_AGENT') ?? '',
);
console.log(
  `SEC reports for ${Object.keys(facts).length} of ${u.symbols.length} symbols; none for: ${missing.join(' ')}`,
);
const bars: Record<string, StrategyBar[]> = await yahooDaily(
  [...u.symbols, SAFE_ASSET, 'SPY'],
  from,
  to,
  resolve(process.cwd(), '.cache/yahoo'),
);
const days = Object.fromEntries(
  Object.entries(bars).map(([s, l]) => [
    s,
    l.map((b) => b.timestamp.toISOString().slice(0, 10)),
  ]),
);
/** The close on or before a day. */
const price = (symbol: string, at: string): number | null => {
  const d = days[symbol] ?? [];
  let lo = 0;
  let hi = d.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (d[mid] <= at) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found < 0 ? null : bars[symbol][found].close;
};
const source = fundamentalsFrom(facts, price);
fundamentals.set(source);

// How much of each year's universe has the numbers (missing ones count as average).
const coverage = [...u.yearly]
  .filter(([y]) => y % 3 === 0 || y === to.getUTCFullYear())
  .map(([y, list]) => {
    const at = new Date(Date.UTC(y, 0, 15));
    const has = list.filter((s) => source(s, at)?.ep != null).length;
    return `${y} ${has}/${list.length}`;
  });
console.log(`With earnings and market value: ${coverage.join(', ')}`);
if (values.part === 'fetch') {
  await app.close();
  process.exit(0);
}

const symbols = [...u.symbols, SAFE_ASSET];
async function run(over: Record<string, string>): Promise<Curve[]> {
  pointInTime.set(u.allowed);
  const params = {
    ...DEFAULT_PARAMS,
    ...(values.profile === 'b' ? { marketFilter: '200' } : {}),
    ...over,
  };
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
const PERIODS = [
  ['2011-01-01', '2016-01-01'],
  ['2016-01-01', '2021-01-01'],
  ['2021-01-01', '2027-01-01'],
];
const show = (name: string, c: Curve[]) => {
  const s = curveStats(c);
  const parts = PERIODS.map(([a, b]) => {
    const part = c.filter(
      (p) => p.timestamp >= new Date(a) && p.timestamp < new Date(b),
    );
    return `${a.slice(2, 4)}-${String(Number(b.slice(2, 4)) - 1)} ${pct(curveStats(part).annualPct)}`;
  });
  console.log(
    `${name.padEnd(30)} ${pct(s.annualPct).padStart(7)}/yr  worst drop -${s.maxDrawdownPct.toFixed(1)}%   ${parts.join('  ')}`,
  );
  return c;
};

const first = await run({});
show(`${values.profile} momentum (now)`, first);
const spy = bars.SPY.filter((b) => b.timestamp >= first[0].timestamp).map(
  (b) => ({
    timestamp: b.timestamp,
    equity: b.close,
  }),
);
show('SPY', spy);
for (const [blend, name] of [
  ['1', 'momentum + value'],
  ['2', 'momentum + quality'],
  ['3', 'momentum + value + quality'],
  ['4', 'momentum, better-quality half'],
  ['5', 'value + quality only'],
])
  show(`${values.profile} ${name}`, await run({ blend }));
await app.close();
