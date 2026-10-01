import { planLabel } from '../../backtest/plans/plan-menu.js';
import type { RobustnessResult } from './robustness.types.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Terminal table: one line per symbol, then the verdict. */
export function formatRobustness(r: RobustnessResult): string {
  const lines = [
    `\nMulti-symbol check  ${planLabel(r.plan)} (${day(r.from)} → ${day(r.to)}, each symbol on its own)`,
    ' Symbol   Result   Holding  Max drop  Trades   Score',
  ];
  for (const row of r.rows) {
    const o = row.outcome;
    lines.push(
      o
        ? [
            ` ${row.symbol.padEnd(6)}`,
            pct(o.returnPct).padStart(8),
            pct(o.holdReturnPct).padStart(9),
            pct(-o.maxDrawdownPct).padStart(9),
            String(o.trades).padStart(7),
            `${row.score?.toFixed(2).padStart(7)}${(row.score ?? 0) > 0 ? '  ✓' : ''}`,
          ].join(' ')
        : ` ${row.symbol.padEnd(6)}  failed: ${row.error}`,
    );
  }
  lines.push(r.summary.verdict);
  return lines.join('\n');
}
