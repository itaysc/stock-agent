import { DISCLAIMER } from '../backtest-report.js';
import { paramsText } from '../sweep/sweep-report.js';
import type { WalkForwardResult } from './walkforward.types.js';
import { formatDuration } from './windows.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const day = (d: Date) => d.toISOString().slice(0, 10);

/** One line describing the setup, shared by the text and HTML reports. */
export function walkForwardSetup(r: WalkForwardResult): string {
  return (
    `train ${formatDuration(r.train)}, test ${formatDuration(r.test)} ` +
    `(${r.anchored ? 'anchored' : 'rolling'}), best by ${r.sort}` +
    (r.minTrades ? `, min ${r.minTrades} trades` : '')
  );
}

export function formatWalkForward(r: WalkForwardResult): string {
  const m = r.metrics;
  const lines = [
    `Walk-forward  ${r.strategies.join(', ')} on ${r.symbols.join(', ')}: ${walkForwardSetup(r)}`,
    `Unseen data   ${day(r.oosFrom)} → ${day(r.oosTo)} (${r.windows.length} test windows)`,
    `Equity        ${money(r.initialCash)} → ${money(r.finalEquity)}`,
    `Return        ${pct(m.totalReturnPct)}  (buy & hold: ${pct(m.buyAndHoldReturnPct)})`,
    `Annualized    ${pct(r.outOfSampleAnnualPct)} on unseen data vs ${pct(r.inSampleAnnualPct)} in training`,
    `Efficiency    ${r.efficiencyPct === null ? 'n/a' : `${r.efficiencyPct.toFixed(0)}%`} (unseen ÷ training; ~50%+ is decent, ~0 = mostly noise)`,
    `Max drawdown  ${pct(-m.maxDrawdownPct)}`,
    `Trades        ${m.trades} closed, win rate ${pct(m.winRatePct).replace('+', '')}, profit factor ${m.profitFactor?.toFixed(2) ?? 'n/a'}`,
    `Interest      ${money(r.interestEarned)} on idle cash (${r.cashYieldPct}% a year, included above)`,
    `Settings      ${r.distinctSettings} distinct, changed ${r.paramChanges} times over ${r.windows.length} windows`,
    '',
    ' #  Train               Chosen setting                     Train ret  Test                Test ret  Trades',
  ];
  for (const w of r.windows) {
    lines.push(
      [
        String(w.index).padStart(2),
        `${day(w.trainFrom)}…${day(w.trainTo).slice(2)}`,
        (w.chosen
          ? `${w.chosen.strategy} ${paramsText(w.chosen.params)}`
          : '(no valid setting)'
        ).padEnd(34),
        pct(w.chosen?.trainReturnPct).padStart(9),
        ` ${day(w.testFrom)}…${day(w.testTo).slice(2)}`,
        pct(w.test?.returnPct).padStart(9),
        String(w.test?.trades ?? '').padStart(7),
      ].join('  '),
    );
  }
  lines.push('', DISCLAIMER);
  return lines.join('\n');
}
