import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ConfigService } from '@nestjs/config';
import { createBacktestApp } from '../../backtest/cli-app.js';
import { WalkForwardService } from '../../backtest/walkforward/walkforward.service.js';
import { earningsDays } from '../../strategies/rotation/rotation-events.js';
import { pointInTime } from '../../strategies/rotation/rotation-universe.js';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import { INDEX_PARAMS, INDEX_SYMBOLS, profileById } from '../profiles.js';
import { SAFE_ASSET } from '../universe.js';
import { mixedCurve, type Curve } from './profile-stats.js';
import { saveRobustness } from './robust-save.js';
import { secEarningsDays } from './sec-announcements.js';
import {
  periodReturns,
  precision,
  variation,
  type RobustPart,
} from './robust-stats.js';
import { sp500Top } from './sp500-universe.js';
import { yahooDaily } from './yahoo-history.js';

/**
 * How solid the profiles' numbers are (same walk-forward as profiles.cli). Run the parts
 * (in parallel is fine), then save; commit src/broker/profile-robustness.data.ts:
 *   node dist/broker/lab/robust.cli.js --part periods
 *   node dist/broker/lab/robust.cli.js --part offset --profile a   (and b)
 *   node dist/broker/lab/robust.cli.js --part subsets --profile a  (and b)
 *   node dist/broker/lab/robust.cli.js --part save
 * offset: the re-rank on each day of the week; subsets: 8 runs without a random 20% of the stocks.
 * Profile b (Balanced) also gives Careful (half Balanced, half the SPY/T-bills part).
 */
const { values } = parseArgs({
  options: {
    part: { type: 'string', default: 'periods' },
    profile: { type: 'string', default: 'a' },
    // A variant to test, e.g. --with tranches=5,lookbackMix=1 (saved under variants/, not merged by save).
    with: { type: 'string', default: '' },
    offsets: { type: 'string', default: '0,1,2,3,4' },
    // close: orders fill in the signal day's closing auction instead of the next open.
    fill: { type: 'string', default: 'open' },
  },
});
const variant = Object.fromEntries(
  values.with
    .split(',')
    .filter(Boolean)
    .map((kv) => kv.split('=') as [string, string]),
);
const tag = [values.with, values.fill === 'close' ? 'fillclose' : '']
  .filter(Boolean)
  .join('_')
  .replace(/[^a-zA-Z0-9]+/g, '_');
const dir = resolve(process.cwd(), '.cache/robust');
mkdirSync(dir, { recursive: true });
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

if (values.part === 'save') {
  saveRobustness(dir);
  process.exit(0);
}

const from = new Date('2005-01-01');
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

// earningsWait needs each stock's past earnings days (from the SEC's filing lists).
if (Number(variant.earningsWait) > 0)
  earningsDays.set(
    await secEarningsDays(
      u.symbols,
      resolve(process.cwd(), '.cache/sec'),
      app.get(ConfigService).get<string>('SEC_USER_AGENT') ?? '',
    ),
  );

async function run(
  symbols: string[],
  params: Record<string, string>,
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
      fillAtClose: values.fill === 'close',
    },
    Object.fromEntries(symbols.map((x) => [x, bars[x] ?? []])),
    { SPY: bars.SPY },
  );
  return r.equityCurve;
}
/** The stocks part of profile a (Aggressive) or b (Balanced), on the stocks `keep` allows. */
const stocks = (
  profile: string,
  extra: Record<string, string> = {},
  keep: (s: string) => boolean = () => true,
) =>
  run(
    [...u.symbols.filter(keep), SAFE_ASSET],
    { ...stocksParams(profile), ...variant, ...extra },
    (s, at) => keep(s) && u.allowed(s, at),
  );
/** The stocks part's settings of Aggressive (a) or Balanced (b, also Careful's stocks half), as the broker runs them. */
function stocksParams(profile: string): Record<string, string> {
  const p = profileById(profile === 'b' ? 'balanced' : 'aggressive');
  if (!p) throw new Error('No such profile');
  return p.sleeves[0].params;
}
const careful = (balanced: Curve[], index: Curve[]) =>
  mixedCurve([
    { curve: balanced, weight: 0.5 },
    { curve: index, weight: 0.5 },
  ]);

const part: RobustPart = { variations: {} };
const add = (id: string, c: Curve[]) => {
  (part.variations[id] ??= []).push(variation(c));
  const v = variation(c);
  console.log(
    `${id.padEnd(11)} ${pct(v.annualPct)}/yr  worst drop -${v.maxDrawdownPct.toFixed(1)}%`,
  );
};
const id = values.profile === 'b' ? 'balanced' : 'aggressive';

if (values.part === 'periods') {
  const aggressive = await stocks('a');
  const balanced = await stocks('b');
  const all = {
    aggressive,
    balanced,
    careful: careful(balanced, await run(INDEX_SYMBOLS, INDEX_PARAMS, null)),
    spy: bars.SPY.filter((b) => b.timestamp >= aggressive[0].timestamp).map(
      (b) => ({ timestamp: b.timestamp, equity: b.close }),
    ),
  };
  part.periods = {};
  part.tVsSpy = {};
  for (const [name, c] of Object.entries(all)) {
    part.periods[name] = periodReturns(c);
    const p = precision(c, all.spy);
    if (name !== 'spy') part.tVsSpy[name] = p.tVsSpy;
    console.log(
      `${name.padEnd(11)} ${part.periods[name].map((x) => `${x.from}-${x.to} ${pct(x.pct)}`).join('  ')}  ±${p.plusMinus.toFixed(1)}%  t ${p.tVsSpy.toFixed(2)}`,
    );
  }
} else if (values.part === 'offset') {
  // With tranches every day re-ranks a part, so moving the re-rank day changes nothing: one run.
  const tranched =
    Number({ ...stocksParams(values.profile), ...variant }.tranches) > 1;
  for (const o of tranched ? [0] : values.offsets.split(',').map(Number)) {
    const shift = { rebalanceOffset: String(o) };
    const c = await stocks(values.profile, shift);
    add(id, c);
    if (values.profile === 'b')
      add(
        'careful',
        careful(
          c,
          await run(INDEX_SYMBOLS, { ...INDEX_PARAMS, ...shift }, null),
        ),
      );
  }
} else {
  // A fixed pseudo-random sequence per seed, so a run can be repeated.
  const rand = (seed: number) => () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const index = await run(INDEX_SYMBOLS, INDEX_PARAMS, null);
  for (let seed = 1; seed <= 8; seed++) {
    const r = rand(seed * 7919);
    const dropped = new Set(u.symbols.filter(() => r() < 0.2));
    const c = await stocks(values.profile, {}, (s) => !dropped.has(s));
    add(id, c);
    if (values.profile === 'b') add('careful', careful(c, index));
  }
}
const out = tag ? resolve(dir, 'variants') : dir;
mkdirSync(out, { recursive: true });
writeFileSync(
  resolve(out, `${values.part}-${values.profile}${tag ? `-${tag}` : ''}.json`),
  JSON.stringify(part),
);
await app.close();
