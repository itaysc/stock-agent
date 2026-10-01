import { DISCLAIMER } from '../backtest-report.js';
import type { SweepResult, SweepRow } from './sweep.service.js';

export const SORT_KEYS = [
  'return',
  'drawdown',
  'profit-factor',
  'return-dd',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const pct = (n: number | null) =>
  n === null ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const day = (d?: Date) => d?.toISOString().slice(0, 10) ?? 'n/a';
export const paramsText = (p: Record<string, string>) =>
  Object.entries(p)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ') || '(defaults)';

/**
 * Return per unit of drawdown: higher = smoother gains. Drawdowns under 5%
 * count as 5%, so a near-riskless fluke (one small trade) can't top the list.
 */
const returnPerDrawdown = (r: SweepRow) =>
  r.metrics.totalReturnPct / Math.max(r.metrics.maxDrawdownPct, 5);

/** Drops runs with too few trades to mean anything; returns how many were hidden. */
export function filterMinTrades(
  result: SweepResult,
  minTrades: number,
): { result: SweepResult; hidden: number } {
  const rows = result.rows.filter((r) => r.metrics.trades >= minTrades);
  return {
    result: { ...result, rows },
    hidden: result.rows.length - rows.length,
  };
}

const SORTERS: Record<SortKey, (a: SweepRow, b: SweepRow) => number> = {
  return: (a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct,
  drawdown: (a, b) => a.metrics.maxDrawdownPct - b.metrics.maxDrawdownPct,
  'profit-factor': (a, b) =>
    (b.metrics.profitFactor ?? -1) - (a.metrics.profitFactor ?? -1),
  'return-dd': (a, b) => returnPerDrawdown(b) - returnPerDrawdown(a),
};

export function sortRows(rows: SweepRow[], key: SortKey): SweepRow[] {
  return [...rows].sort(SORTERS[key]);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function table(rows: SweepRow[]): string[] {
  const head = [
    '#',
    'Strategy',
    'Params',
    'Return',
    'Max DD',
    'Trades',
    'Win %',
    'PF',
  ];
  const body = rows.map((r, i) => [
    String(i + 1),
    r.strategy,
    paramsText(r.params),
    pct(r.metrics.totalReturnPct),
    `-${r.metrics.maxDrawdownPct.toFixed(2)}%`,
    String(r.metrics.trades),
    r.metrics.winRatePct === null ? 'n/a' : r.metrics.winRatePct.toFixed(0),
    r.metrics.profitFactor === null ? 'n/a' : r.metrics.profitFactor.toFixed(2),
  ]);
  const widths = head.map((h, c) =>
    Math.max(h.length, ...body.map((row) => row[c].length)),
  );
  const right = new Set([0, 3, 4, 5, 6, 7]);
  const fmt = (row: string[]) =>
    row
      .map((cell, c) =>
        right.has(c) ? cell.padStart(widths[c]) : cell.padEnd(widths[c]),
      )
      .join('  ');
  return [
    fmt(head),
    widths.map((w) => '-'.repeat(w)).join('  '),
    ...body.map(fmt),
  ];
}

/** Ranked table plus a robustness summary. */
export function formatSweep(
  result: SweepResult,
  sort: SortKey,
  top: number,
): string {
  const rows = sortRows(result.rows, sort);
  const hold = result.buyAndHoldReturnPct;
  const lines = [
    `${result.rows.length} backtests on ${result.symbols.join(', ')}, ` +
      `${day(result.from)} → ${day(result.to)} (${result.bars} bars). Buy & hold: ${pct(hold)}`,
    '',
    ...table(rows.slice(0, top)),
  ];
  if (rows.length > top)
    lines.push(`... ${rows.length - top} more (use --top)`);

  lines.push('', `Summary (sorted by ${sort}):`);
  for (const strategy of new Set(result.rows.map((r) => r.strategy))) {
    const own = result.rows.filter((r) => r.strategy === strategy);
    const returns = own.map((r) => r.metrics.totalReturnPct);
    const beat = hold === null ? 0 : returns.filter((r) => r > hold).length;
    lines.push(
      `  ${strategy}: median return ${pct(median(returns))}, ` +
        `${returns.filter((r) => r > 0).length}/${own.length} positive, ` +
        `${beat}/${own.length} beat buy & hold`,
    );
  }
  if (result.skipped.length > 0) {
    lines.push(
      `  Skipped ${result.skipped.length} invalid combinations (e.g. ${result.skipped[0].error})`,
    );
  }
  lines.push(
    '',
    'Tip: trust a strategy more when many nearby settings do well, not just the top row.',
    DISCLAIMER,
  );
  return lines.join('\n');
}

export function toCsv(result: SweepResult): string {
  const keys = [...new Set(result.rows.flatMap((r) => Object.keys(r.params)))];
  const head = [
    'strategy',
    ...keys,
    'return_pct',
    'max_drawdown_pct',
    'trades',
    'win_rate_pct',
    'profit_factor',
    'final_equity',
  ];
  const rows = result.rows.map((r) => [
    r.strategy,
    ...keys.map((k) => r.params[k] ?? ''),
    r.metrics.totalReturnPct.toFixed(4),
    r.metrics.maxDrawdownPct.toFixed(4),
    r.metrics.trades,
    r.metrics.winRatePct?.toFixed(2) ?? '',
    r.metrics.profitFactor?.toFixed(4) ?? '',
    r.finalEquity.toFixed(2),
  ]);
  return [head, ...rows].map((row) => row.join(',')).join('\n') + '\n';
}
