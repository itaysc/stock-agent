import type { BacktestResult } from './backtest-engine.js';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const percent = (n: number | null) => (n === null ? 'n/a' : `${n.toFixed(2)}%`);
const day = (d?: Date) => d?.toISOString().slice(0, 10) ?? 'n/a';

export const DISCLAIMER =
  'Hypothetical simulation on historical data. Past results do not predict future ' +
  'results, and real fills, fees and liquidity differ. Not investment advice.';

/** Human-readable summary of a backtest, for the CLI. */
export function formatReport(result: BacktestResult, tradeLimit = 20): string {
  const m = result.metrics;
  const lines = [
    `Strategy     ${result.strategy} on ${result.symbols.join(', ')}`,
    `Period       ${day(result.from)} → ${day(result.to)} (${result.bars} bars)`,
    `Equity       ${money(result.initialCash)} → ${money(result.finalEquity)}`,
    `Return       ${percent(m.totalReturnPct)}  (buy & hold: ${percent(m.buyAndHoldReturnPct)})`,
    `Max drawdown ${percent(m.maxDrawdownPct)}`,
    `Trades       ${m.trades} closed, win rate ${percent(m.winRatePct)}, ` +
      `profit factor ${m.profitFactor === null ? 'n/a' : m.profitFactor.toFixed(2)}`,
    `Fees         ${money(m.totalFees)}`,
    `Interest     ${money(result.interestEarned ?? 0)} earned on idle cash`,
  ];

  if (result.openPositions.length > 0) {
    const open = result.openPositions
      .map((p) => `${p.qty} ${p.symbol} @ ${p.avgPrice.toFixed(2)}`)
      .join(', ');
    lines.push(`Open         ${open} (valued at the last close)`);
  }
  if (result.rejections.length > 0) {
    const byReason = new Map<string, number>();
    for (const r of result.rejections) {
      byReason.set(r.error, (byReason.get(r.error) ?? 0) + 1);
    }
    const reasons = [...byReason].map(([e, n]) => `${e}: ${n}`).join(', ');
    lines.push(`Rejected     ${result.rejections.length} orders (${reasons})`);
  }
  const reducedBuys = result.fills.filter(
    (f) => f.requestedQty !== undefined,
  ).length;
  if (reducedBuys > 0) {
    lines.push(
      `Reduced      ${reducedBuys} buys to fit the cash (price opened above the signal)`,
    );
  }
  if (result.unfilledOrders > 0) {
    lines.push(
      `Unfilled     ${result.unfilledOrders} orders placed on the last bar`,
    );
  }

  const recent = result.fills.slice(-tradeLimit);
  if (recent.length > 0) {
    lines.push('', `Last ${recent.length} fills:`);
    for (const f of recent) {
      const pnl =
        f.realizedPnl === undefined ? '' : `  P&L ${money(f.realizedPnl)}`;
      lines.push(
        `  ${day(f.timestamp)} ${f.side.padEnd(4)} ${String(f.qty).padStart(6)} ` +
          `${f.symbol} @ ${f.price.toFixed(2)}${pnl}`,
      );
    }
  }

  lines.push('', DISCLAIMER);
  return lines.join('\n');
}
