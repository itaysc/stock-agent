import type { Fill, StrategyBar } from '../strategies/strategy.types.js';

export interface EquityPoint {
  timestamp: Date;
  equity: number;
}

export interface BacktestMetrics {
  totalReturnPct: number;
  /** Largest peak-to-trough fall of the equity curve. */
  maxDrawdownPct: number;
  /** Closing (sell) trades. */
  trades: number;
  winRatePct: number | null;
  /** Gross profit / gross loss; null when there were no losing trades. */
  profitFactor: number | null;
  totalFees: number;
  /** Equal-weight buy & hold of the same symbols over the same bars, for comparison. */
  buyAndHoldReturnPct: number | null;
}

const pct = (ratio: number) => ratio * 100;

export function maxDrawdownPct(curve: EquityPoint[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const { equity } of curve) {
    peak = Math.max(peak, equity);
    if (peak > 0) worst = Math.max(worst, (peak - equity) / peak);
  }
  return pct(worst);
}

export function buyAndHoldReturnPct(
  barsBySymbol: Record<string, StrategyBar[]>,
): number | null {
  const returns = Object.values(barsBySymbol)
    .filter((bars) => bars.length > 1 && bars[0].open > 0)
    .map((bars) => bars[bars.length - 1].close / bars[0].open - 1);
  if (returns.length === 0) return null;
  return pct(returns.reduce((a, b) => a + b, 0) / returns.length);
}

export function computeMetrics(
  initialCash: number,
  curve: EquityPoint[],
  fills: Fill[],
  barsBySymbol: Record<string, StrategyBar[]>,
): BacktestMetrics {
  const finalEquity = curve.at(-1)?.equity ?? initialCash;
  const closed = fills.filter((f) => f.realizedPnl !== undefined);
  const pnls = closed.map((f) => f.realizedPnl as number);
  const grossProfit = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = -pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0);

  return {
    totalReturnPct: pct(finalEquity / initialCash - 1),
    maxDrawdownPct: maxDrawdownPct(curve),
    trades: closed.length,
    winRatePct: closed.length
      ? pct(pnls.filter((p) => p > 0).length / closed.length)
      : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    totalFees: fills.reduce((sum, f) => sum + f.fee, 0),
    buyAndHoldReturnPct: buyAndHoldReturnPct(barsBySymbol),
  };
}
