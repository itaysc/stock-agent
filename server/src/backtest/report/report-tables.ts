import type { ReportData } from './report-data.js';
import type { ReportHelpers } from './report-helpers.js';

/** Browser-side: summary tiles. Embedded via toString(), see report-helpers.ts. */
export function renderTiles(data: ReportData, h: ReportHelpers): void {
  const { el, $, money, pct, tone } = h;
  // Summary tiles
  const m = data.metrics;
  const tiles: Array<[string, string, string, string]> = [
    [
      'Return',
      pct(m.totalReturnPct),
      `Buy & hold ${pct(m.buyAndHoldReturnPct)}`,
      tone(m.totalReturnPct),
    ],
    [
      'Final equity',
      money(data.finalEquity),
      `from ${money(data.initialCash)}`,
      '',
    ],
    [
      'Max drawdown',
      pct(-m.maxDrawdownPct, false),
      'peak to trough',
      m.maxDrawdownPct > 0 ? 'loss' : '',
    ],
    [
      'Closed trades',
      String(m.trades),
      `win rate ${pct(m.winRatePct, false)}`,
      '',
    ],
    [
      'Profit factor',
      m.profitFactor === null ? 'n/a' : m.profitFactor.toFixed(2),
      'gross profit / loss',
      '',
    ],
    [
      'Fees',
      money(m.totalFees),
      data.rejections
        ? `${data.rejections} orders rejected`
        : 'no rejected orders',
      '',
    ],
  ];
  for (const [label, value, sub, cls] of tiles) {
    const tile = el('div', '', 'tile');
    tile.append(
      el('div', label, 'label'),
      el('div', value, `value ${cls}`),
      el('div', sub, 'sub'),
    );
    $('tiles').append(tile);
  }
}

/** Browser-side: fills table. Embedded via toString(), see report-helpers.ts. */
export function renderFills(data: ReportData, h: ReportHelpers): void {
  const { el, $, money, tone, stamp } = h;
  // Fills table
  const body = $('fills');
  for (const f of data.fills) {
    const row = el('tr');
    row.append(
      el('td', stamp(f.time)),
      el('td', f.symbol),
      el(
        'td',
        f.side === 'buy' ? 'Buy' : 'Sell',
        f.side === 'buy' ? 'gain' : 'loss',
      ),
      el('td', String(f.qty), 'num'),
      el('td', f.price.toFixed(2), 'num'),
      el('td', f.pnl === null ? '' : money(f.pnl), `num ${tone(f.pnl)}`),
      el('td', f.reason, 'muted'),
    );
    body.append(row);
  }
  if (data.fills.length === 0) $('fills-empty').hidden = false;
}
