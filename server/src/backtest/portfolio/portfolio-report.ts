import { DISCLAIMER } from '../backtest-report.js';
import type { PortfolioResult } from './portfolio.types.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const money = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
const day = (d?: Date) => d?.toISOString().slice(0, 10) ?? 'n/a';

/** Terminal summary of a portfolio backtest. */
export function formatPortfolio(r: PortfolioResult): string {
  const m = r.metrics;
  const lines = [
    `Portfolio    ${r.sleeves.length} sleeves, ${day(r.from)} → ${day(r.to)}`,
    `Equity       ${money(r.initialCash)} → ${money(r.finalEquity)}  (${pct(m.totalReturnPct)})`,
    `Benchmark    ${pct(r.benchmarkReturnPct)}  (each sleeve's money bought and held in its symbols, reserve in cash)`,
    `Max drawdown ${pct(-m.maxDrawdownPct)}  (benchmark ${pct(-r.benchmarkMaxDrawdownPct)})`,
    `Trades       ${m.trades} closed, win rate ${pct(m.winRatePct).replace('+', '')}`,
    `Interest     ${money(r.interestEarned)} on idle cash`,
    `Stop         ${r.risk.maxDrawdownPct ? `sell all at -${r.risk.maxDrawdownPct}% from the peak, pause ${r.risk.cooldownDays} days: triggered ${r.stops.length}×` : 'off'}`,
    '',
    ' Sleeve                                                   Allocated     Result   Holding  Contribution',
  ];
  for (const s of r.sleeves) {
    lines.push(
      [
        ` ${s.label.slice(0, 55).padEnd(55)}`,
        money(s.allocated).padStart(10),
        pct(s.result.metrics.totalReturnPct).padStart(10),
        pct(s.holdReturnPct).padStart(9),
        money(s.contribution).padStart(13),
      ].join(' '),
    );
  }
  if (r.reserve.allocated > 0) {
    lines.push(
      ` ${'Cash reserve'.padEnd(55)} ${money(r.reserve.allocated).padStart(10)}  ${money(r.reserve.final - r.reserve.allocated).padStart(31)}`,
    );
  }
  if (r.sleeves.length > 1) {
    lines.push(
      '',
      'How alike the sleeves move (1 = the same, 0 = unrelated, below 0 = opposite):',
    );
    r.correlation.forEach((row, i) =>
      lines.push(
        `  ${i + 1}. ${row.map((c) => (c === null ? '  n/a' : c.toFixed(2).padStart(5))).join(' ')}`,
      ),
    );
  }
  for (const s of r.stops) {
    lines.push(
      `Stop on ${day(s.timestamp)}: down ${s.drawdownPct.toFixed(1)}% from the peak, sold everything, buys again from ${day(s.resumesAt)}`,
    );
  }
  lines.push('', DISCLAIMER);
  return lines.join('\n');
}
