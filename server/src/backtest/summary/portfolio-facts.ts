import type { PortfolioResult } from '../portfolio/portfolio.types.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const usd = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const day = (d?: Date) => d?.toISOString().slice(0, 10) ?? 'n/a';

/** Fact sheet for the AI summary of a portfolio backtest. */
export function portfolioFacts(r: PortfolioResult): string {
  const m = r.metrics;
  const alike = r.correlation
    .flatMap((row, i) => row.slice(i + 1))
    .filter((c): c is number => c !== null);
  return [
    'Portfolio backtest: several strategies with fixed settings, each on its own symbols and share of the money, run together. The settings were chosen by the user (possibly with hindsight on this same period).',
    `Period ${day(r.from)} to ${day(r.to)} | ${usd(r.initialCash)} → ${usd(r.finalEquity)} (${pct(m.totalReturnPct)})`,
    `Benchmark (each sleeve's money bought and held in its own symbols, the reserve in cash): ${pct(r.benchmarkReturnPct)}`,
    `Max drawdown ${m.maxDrawdownPct.toFixed(2)}% vs benchmark ${r.benchmarkMaxDrawdownPct.toFixed(2)}% | closed trades ${m.trades} | win rate ${pct(m.winRatePct).replace('+', '')}`,
    `Idle cash earns interest (included): ${usd(r.interestEarned)}. Cash reserve: ${usd(r.reserve.allocated)}.`,
    `Portfolio stop: ${r.risk.maxDrawdownPct ? `sell everything at ${r.risk.maxDrawdownPct}% below the peak, pause ${r.risk.cooldownDays} days; triggered ${r.stops.length} times` : 'off'}`,
    `Average correlation of the sleeves' daily moves: ${alike.length ? (alike.reduce((a, b) => a + b, 0) / alike.length).toFixed(2) : 'n/a'} (near 1 = no diversification)`,
    'Sleeves:',
    ...r.sleeves.map(
      (s) =>
        `- ${s.label}: ${pct(s.result.metrics.totalReturnPct)} vs holding its symbols ${pct(s.holdReturnPct)}, max drawdown ${s.result.metrics.maxDrawdownPct.toFixed(1)}%, ${s.result.metrics.trades} trades, contributed ${usd(s.contribution)}`,
    ),
  ].join('\n');
}
