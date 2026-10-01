import { Injectable } from '@nestjs/common';
import {
  infoNeeds,
  usesMarket,
} from '../../strategies/rules/rules-validate.js';
import { createStrategy } from '../../strategies/strategy-registry.js';
import type { Fill, StrategyBar } from '../../strategies/strategy.types.js';
import { runBacktest } from '../backtest-engine.js';
import { computeMetrics, type EquityPoint } from '../backtest-metrics.js';
import { BacktestService, validateRequest } from '../backtest.service.js';
import { buyAndHoldCurve } from '../report/report-data.js';
import { planCombos } from '../sweep/param-grid.js';
import { sortRows } from '../sweep/sweep-report.js';
import type { SweepRow } from '../sweep/sweep.service.js';
import {
  annualizedPct,
  efficiencyPct,
  inSampleAnnualPct,
  paramStability,
} from './walkforward-metrics.js';
import type {
  ChosenSetting,
  WalkForwardRequest,
  WalkForwardResult,
  WindowResult,
} from './walkforward.types.js';
import { buildWindows, parseDuration, type Window } from './windows.js';

export type Bars = Record<string, StrategyBar[]>;

/** Bars in [from, to); `from` omitted = from the start (warm-up history). */
const slice = (bars: Bars, to: Date, from?: Date): Bars =>
  Object.fromEntries(
    Object.entries(bars).map(([s, list]) => [
      s,
      list.filter((b) => b.timestamp < to && (!from || b.timestamp >= from)),
    ]),
  );

/**
 * Walk-forward test: for each window, pick the best setting on the training
 * period, then trade only that setting on the following, unseen test period.
 * The stitched test periods show how the tuning would have done in practice.
 */
@Injectable()
export class WalkForwardService {
  constructor(private readonly backtests: BacktestService) {}

  /**
   * `bars` / `market`: already fetched bars (e.g. many tests on the same
   * data), fetched otherwise. `market` = SPY for the market filter.
   */
  async run(
    request: WalkForwardRequest,
    bars?: Bars,
    market?: Bars,
  ): Promise<WalkForwardResult> {
    validateRequest(request);
    const symbols = request.symbols.map((s) => s.trim().toUpperCase());
    const train = parseDuration(request.train);
    const test = parseDuration(request.test);
    const windows = buildWindows(
      request.from,
      request.to,
      train,
      test,
      request.anchored,
    );
    const plans = planCombos(request.strategies, request.grid);
    bars ??= await this.backtests.fetchBars(
      symbols,
      request,
      infoNeeds(request.strategies, request.grid, request.newsGateTone),
    );
    market ??= await this.backtests.fetchMarket(
      usesMarket(request.strategies, request.grid),
      request,
    );

    let equity = request.initialCash;
    let interest = 0;
    const equityCurve: EquityPoint[] = [];
    const fills: Fill[] = [];
    const results: WindowResult[] = [];
    for (const window of windows) {
      const { chosen, candidates, qualified } = this.train(
        window,
        plans,
        bars,
        market,
        request,
        symbols,
      );
      const result: WindowResult = {
        ...window,
        candidates,
        qualified,
        chosen,
        test: null,
      };
      if (chosen) {
        // Each window trades its own setting, so it ends flat: open positions
        // are sold at the window's last close and the next one starts in cash.
        const run = runBacktest(
          createStrategy(chosen.strategy, symbols, chosen.params),
          slice(bars, window.testTo),
          { ...request, initialCash: equity },
          {
            startAt: window.testFrom,
            closeAtEnd: true,
            market: slice(market, window.testTo),
          },
        );
        result.test = {
          returnPct: run.metrics.totalReturnPct,
          maxDrawdownPct: run.metrics.maxDrawdownPct,
          trades: run.metrics.trades,
          startEquity: equity,
          endEquity: run.finalEquity,
          buyAndHoldReturnPct: run.metrics.buyAndHoldReturnPct,
        };
        equityCurve.push(...run.equityCurve);
        fills.push(...run.fills);
        interest += run.interestEarned;
        equity = run.finalEquity;
      }
      results.push(result);
    }

    const oosFrom = windows[0].testFrom;
    const oosTo = windows.at(-1)?.testTo ?? request.to;
    const oosBars = slice(bars, oosTo, oosFrom);
    const metrics = computeMetrics(
      request.initialCash,
      equityCurve,
      fills,
      oosBars,
    );
    const inSample = inSampleAnnualPct(results);
    const outOfSample = annualizedPct(metrics.totalReturnPct, oosFrom, oosTo);
    return {
      symbols,
      strategies: request.strategies,
      timeframe: request.timeframe,
      train,
      test,
      anchored: request.anchored ?? false,
      sort: request.sort,
      minTrades: request.minTrades ?? 0,
      slippageBps: request.slippageBps,
      feePerShare: request.feePerShare,
      cashYieldPct: request.cashYieldPct ?? 0,
      interestEarned: interest,
      oosFrom,
      oosTo,
      windows: results,
      initialCash: request.initialCash,
      finalEquity: equity,
      metrics,
      equityCurve,
      buyAndHold: buyAndHoldCurve(
        oosBars,
        request.initialCash,
        equityCurve.map((p) => p.timestamp),
      ),
      inSampleAnnualPct: inSample,
      outOfSampleAnnualPct: outOfSample,
      efficiencyPct: efficiencyPct(inSample, outOfSample),
      ...paramStability(results),
      fills,
    };
  }

  /** Runs every setting on the training period and picks the best eligible one. */
  private train(
    window: Window,
    plans: ReturnType<typeof planCombos>,
    bars: Bars,
    market: Bars,
    request: WalkForwardRequest,
    symbols: string[],
  ): { chosen: ChosenSetting | null; candidates: number; qualified: number } {
    const trainBars = slice(bars, window.trainTo);
    const trainMarket = slice(market, window.trainTo);
    const rows: SweepRow[] = [];
    for (const { strategy, combos } of plans) {
      for (const params of combos) {
        try {
          const run = runBacktest(
            createStrategy(strategy, symbols, params),
            trainBars,
            request,
            {
              startAt: window.trainFrom,
              closeAtEnd: true,
              market: trainMarket,
            },
          );
          rows.push({
            strategy,
            params,
            metrics: run.metrics,
            finalEquity: run.finalEquity,
            openPositions: 0,
            equity: [],
          });
        } catch {
          // invalid combination (e.g. fast >= slow): not a candidate
        }
      }
    }
    const eligible = rows.filter(
      (r) => r.metrics.trades >= (request.minTrades ?? 0),
    );
    const best = sortRows(eligible.length ? eligible : rows, request.sort)[0];
    return {
      candidates: rows.length,
      qualified: eligible.length,
      chosen: best
        ? {
            strategy: best.strategy,
            params: best.params,
            trainReturnPct: best.metrics.totalReturnPct,
            trainMaxDrawdownPct: best.metrics.maxDrawdownPct,
            trainTrades: best.metrics.trades,
          }
        : null,
    };
  }
}
