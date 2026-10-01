import { Injectable } from '@nestjs/common';
import {
  infoNeeds,
  usesMarket,
} from '../../strategies/rules/rules-validate.js';
import { createStrategy } from '../../strategies/strategy-registry.js';
import { buildTimeline, runBacktest } from '../backtest-engine.js';
import {
  type BacktestMetrics,
  buyAndHoldReturnPct,
} from '../backtest-metrics.js';
import {
  type BacktestRequest,
  BacktestService,
  validateRequest,
} from '../backtest.service.js';
import { buyAndHoldCurve } from '../report/report-data.js';
import { type ParamGrid, planCombos } from './param-grid.js';

export interface SweepRequest extends Omit<
  BacktestRequest,
  'strategy' | 'params'
> {
  strategies: string[];
  grid: ParamGrid;
}

export interface SweepRow {
  strategy: string;
  /** The swept params for this run (unlisted params use the strategy default). */
  params: Record<string, string>;
  metrics: BacktestMetrics;
  finalEquity: number;
  openPositions: number;
  /** Equity after each bar, aligned with SweepResult.timestamps (for charts). */
  equity: number[];
}

export interface SweepResult {
  symbols: string[];
  from?: Date;
  to?: Date;
  bars: number;
  timestamps: Date[];
  buyAndHoldReturnPct: number | null;
  /** Equal-weight buy & hold equity, aligned with timestamps. */
  buyAndHold: number[];
  rows: SweepRow[];
  skipped: Array<{
    strategy: string;
    params: Record<string, string>;
    error: string;
  }>;
}

/**
 * Runs a strategy (or several) over every combination of the given params.
 * Bars are fetched once and reused, so each extra run costs milliseconds.
 */
@Injectable()
export class SweepService {
  constructor(private readonly backtests: BacktestService) {}

  async run(request: SweepRequest): Promise<SweepResult> {
    validateRequest(request);
    const symbols = request.symbols.map((s) => s.trim().toUpperCase());
    const plans = planCombos(request.strategies, request.grid);
    const bars = await this.backtests.fetchBars(
      symbols,
      request,
      infoNeeds(request.strategies, request.grid, request.newsGateTone),
    );
    const market = await this.backtests.fetchMarket(
      usesMarket(request.strategies, request.grid),
      request,
    );

    const timeline = buildTimeline(bars);
    const result: SweepResult = {
      symbols,
      from: timeline[0]?.timestamp,
      to: timeline.at(-1)?.timestamp,
      bars: timeline.length,
      timestamps: timeline.map((t) => t.timestamp),
      buyAndHoldReturnPct: buyAndHoldReturnPct(bars),
      buyAndHold: buyAndHoldCurve(
        bars,
        request.initialCash,
        timeline.map((t) => t.timestamp),
      ),
      rows: [],
      skipped: [],
    };
    for (const { strategy, combos } of plans) {
      for (const params of combos) {
        try {
          const run = runBacktest(
            createStrategy(strategy, symbols, params),
            bars,
            request,
            { market },
          );
          result.rows.push({
            strategy,
            params,
            metrics: run.metrics,
            finalEquity: run.finalEquity,
            openPositions: run.openPositions.length,
            equity: run.equityCurve.map((p) => p.equity),
          });
        } catch (err) {
          result.skipped.push({
            strategy,
            params,
            error: (err as Error).message,
          });
        }
      }
    }
    return result;
  }
}
