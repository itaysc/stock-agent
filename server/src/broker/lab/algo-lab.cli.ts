import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { BacktestService } from '../../backtest/backtest.service.js';
import { createBacktestApp } from '../../backtest/cli-app.js';
import { WalkForwardService } from '../../backtest/walkforward/walkforward.service.js';
import { outcomeOf } from '../../research/research-score.js';
import type { StrategyBar } from '../../strategies/strategy.types.js';
import { SAFE_ASSET } from '../universe.js';
import { EXITS, SENSITIVITY, UNIVERSES, VARIANTS } from './lab-variants.js';

/**
 * The algo lab: every variant of the broker's algo through the same
 * walk-forward (settings picked on 2 years, scored on the 6 months after),
 * on a universe, vs holding SPY and holding all the stocks. Prices are
 * fetched once and cached (--cache).
 *   node dist/broker/lab/algo-lab.cli.js --universe 2020 --cache /tmp/bars.json
 */
const { values } = parseArgs({
  options: {
    universe: { type: 'string', default: 'today' },
    cache: { type: 'string' },
    from: { type: 'string', default: '2020-07-27' },
    only: { type: 'string' },
    cash: { type: 'string', default: '10000' },
    set: { type: 'string', default: 'methods' },
    windows: { type: 'boolean', default: false },
  },
});
type Bars = Record<string, StrategyBar[]>;
const symbols = [
  ...UNIVERSES[values.universe as keyof typeof UNIVERSES],
  SAFE_ASSET,
];
const from = new Date(values.from);
const to = new Date();

const app = await createBacktestApp();
const revive = (b: Bars): Bars =>
  Object.fromEntries(
    Object.entries(b).map(([s, l]) => [
      s,
      l.map((x) => ({ ...x, timestamp: new Date(x.timestamp) })),
    ]),
  );
let data: { bars: Bars; market: Bars };
if (values.cache && existsSync(values.cache)) {
  const raw = JSON.parse(readFileSync(values.cache, 'utf8')) as {
    bars: Bars;
    market: Bars;
  };
  data = { bars: revive(raw.bars), market: revive(raw.market) };
} else {
  const backtests = app.get(BacktestService);
  const range = { timeframe: '1Day', from, to };
  data = {
    bars: await backtests.fetchBars(symbols, range),
    market: await backtests.fetchBars(['SPY'], range),
  };
  if (values.cache) writeFileSync(values.cache, JSON.stringify(data));
}
const missing = symbols.filter((s) => !data.bars[s]?.length);
if (missing.length) console.log(`No data (left out): ${missing.join(', ')}`);
const traded = symbols.filter((s) => data.bars[s]?.length);

const signed = (n: number | null | undefined) =>
  n == null ? 'n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const spyReturn = (a: Date, b: Date) => {
  const spy = data.market.SPY ?? [];
  const start = spy.find((x) => x.timestamp >= a);
  const end = spy.filter((x) => x.timestamp <= b).at(-1);
  return start && end ? (end.close / start.close - 1) * 100 : null;
};

console.log(
  `Universe ${values.universe}: ${traded.length} symbols, ${values.from} → today, train 2y / test 6m\n`,
);
console.log(
  'variant'.padEnd(34) +
    'return  annual  maxDD  trades  hold-all  SPY     picks',
);
for (const v of (
  { sensitivity: SENSITIVITY, exits: EXITS }[values.set ?? ''] ?? VARIANTS
).filter((x) => !values.only || values.only.split(',').includes(x.name))) {
  const r = await app.get(WalkForwardService).run(
    {
      strategies: ['momentum-rotation'],
      grid: v.grid,
      symbols: traded,
      timeframe: '1Day',
      from,
      to,
      train: '2y',
      test: '6m',
      sort: 'return-dd',
      initialCash: Number(values.cash),
      slippageBps: 5,
      feePerShare: 0,
      cashYieldPct: 3,
    },
    data.bars,
    data.market,
  );
  const o = outcomeOf(r);
  const picks = [
    ...new Set(
      r.windows.map((w) =>
        Object.entries(w.chosen?.params ?? {})
          .filter(([k]) => v.tuned.includes(k))
          .map(([k, x]) => `${k}=${x}`)
          .join(' '),
      ),
    ),
  ].join(' | ');
  console.log(
    v.name.padEnd(34) +
      [
        signed(o.returnPct),
        signed(o.annualPct),
        `-${o.maxDrawdownPct.toFixed(1)}%`,
        String(o.trades),
        signed(o.holdReturnPct),
        signed(spyReturn(o.from, o.to)),
      ]
        .map((x, i) => x.padEnd([8, 8, 7, 8, 10, 8][i]))
        .join('') +
      picks,
  );
  if (values.windows)
    for (const w of r.windows)
      console.log(
        `   ${String(w.testFrom).slice(0, 10)} → ${String(w.testTo).slice(0, 10)}: ${signed(w.test?.returnPct)} (${w.test?.trades ?? 0} trades)`,
      );
}
await app.close();
