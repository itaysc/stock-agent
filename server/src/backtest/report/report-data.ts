import type { StrategyBar } from '../../strategies/strategy.types.js';
import type { BacktestResult } from '../backtest-engine.js';
import type { BacktestMetrics } from '../backtest-metrics.js';
import type { AiSummary } from '../summary/ai-summary.types.js';

/** Chart point: time in UTC seconds (what the chart library expects). */
export interface Point {
  time: number;
  value: number;
}

export interface ReportData {
  strategy: string;
  symbols: string[];
  from: string | null;
  to: string | null;
  bars: number;
  settings: Record<string, string>;
  initialCash: number;
  finalEquity: number;
  metrics: BacktestMetrics;
  equity: Point[];
  buyAndHold: Point[];
  drawdown: Point[];
  candles: Record<
    string,
    Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
    }>
  >;
  fills: Array<{
    time: number;
    symbol: string;
    side: string;
    qty: number;
    price: number;
    pnl: number | null;
    reason: string;
  }>;
  openPositions: BacktestResult['openPositions'];
  rejections: number;
  aiSummary: AiSummary | null;
}

const seconds = (d: Date) => Math.floor(d.getTime() / 1000);

/** Equal-weight buy & hold of the same symbols: bought at the first open, marked at each close. */
export function buyAndHoldCurve(
  bars: Record<string, StrategyBar[]>,
  initialCash: number,
  timestamps: Date[],
): number[] {
  const series = Object.values(bars).filter(
    (b) => b.length > 0 && b[0].open > 0,
  );
  if (series.length === 0) return timestamps.map(() => initialCash);
  const allocation = initialCash / series.length;
  const state = series.map((b) => ({
    bars: b,
    i: -1,
    shares: allocation / b[0].open,
  }));

  return timestamps.map((t) => {
    let value = 0;
    for (const s of state) {
      while (s.i + 1 < s.bars.length && s.bars[s.i + 1].timestamp <= t) s.i++;
      value += s.i < 0 ? allocation : s.shares * s.bars[s.i].close;
    }
    return value;
  });
}

/** Drawdown from the running peak, in percent (0 or negative). */
export function drawdownCurve(values: number[]): number[] {
  let peak = -Infinity;
  return values.map((v) => {
    peak = Math.max(peak, v);
    return peak > 0 ? (v / peak - 1) * 100 : 0;
  });
}

export function buildReportData(
  result: BacktestResult,
  bars: Record<string, StrategyBar[]>,
  settings: Record<string, string> = {},
  aiSummary: AiSummary | null = null,
): ReportData {
  const timestamps = result.equityCurve.map((p) => p.timestamp);
  const times = timestamps.map(seconds);
  const hold = buyAndHoldCurve(bars, result.initialCash, timestamps);
  const drawdown = drawdownCurve(result.equityCurve.map((p) => p.equity));

  return {
    strategy: result.strategy,
    symbols: result.symbols,
    from: result.from?.toISOString() ?? null,
    to: result.to?.toISOString() ?? null,
    bars: result.bars,
    settings,
    initialCash: result.initialCash,
    finalEquity: result.finalEquity,
    metrics: result.metrics,
    equity: result.equityCurve.map((p, i) => ({
      time: times[i],
      value: p.equity,
    })),
    buyAndHold: hold.map((value, i) => ({ time: times[i], value })),
    drawdown: drawdown.map((value, i) => ({ time: times[i], value })),
    candles: Object.fromEntries(
      Object.entries(bars).map(([symbol, list]) => [
        symbol,
        list.map((b) => ({
          time: seconds(b.timestamp),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })),
      ]),
    ),
    fills: result.fills.map((f) => ({
      time: seconds(f.timestamp),
      symbol: f.symbol,
      side: f.side,
      qty: f.qty,
      price: f.price,
      pnl: f.realizedPnl ?? null,
      reason: f.reason ?? '',
    })),
    openPositions: result.openPositions,
    rejections: result.rejections.length,
    aiSummary,
  };
}
