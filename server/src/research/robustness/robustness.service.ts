import { Injectable } from '@nestjs/common';
import { BacktestService } from '../../backtest/backtest.service.js';
import { planGrid } from '../../backtest/plans/test-plan.js';
import { planCombos } from '../../backtest/sweep/param-grid.js';
import { parseDuration } from '../../backtest/walkforward/windows.js';
import { WalkForwardService } from '../../backtest/walkforward/walkforward.service.js';
import {
  infoNeeds,
  usesMarket,
} from '../../strategies/rules/rules-validate.js';
import { median } from '../../backtest/sweep/sweep-report.js';
import { outcomeOf, scoreOf } from '../research-score.js';
import {
  PASS_SHARE,
  type RobustnessRequest,
  type RobustnessResult,
  type RobustnessSummary,
  type SymbolResult,
} from './robustness.types.js';

/**
 * The multi-symbol check: runs one walk-forward setup on each symbol of a
 * basket on its own, and counts on how many it did better than just holding
 * that symbol. A setup that only works on one symbol is most likely luck.
 */
@Injectable()
export class RobustnessService {
  constructor(
    private readonly backtests: BacktestService,
    private readonly walkForwards: WalkForwardService,
  ) {}

  /** Each symbol on its own. */
  run(request: RobustnessRequest): Promise<RobustnessResult> {
    const symbols = [
      ...new Set(request.symbols.map((s) => s.trim().toUpperCase())),
    ];
    return this.check(
      request,
      symbols.map((s) => ({ label: s, symbols: [s] })),
      'symbols',
    );
  }

  /** Each group as a whole universe (for strategies that rotate between symbols). */
  runUniverses(
    request: RobustnessRequest,
    universes: Array<{ label: string; symbols: string[] }>,
  ): Promise<RobustnessResult> {
    return this.check(request, universes, 'universes');
  }

  private async check(
    request: RobustnessRequest,
    groups: Array<{ label: string; symbols: string[] }>,
    mode: RobustnessResult['mode'],
  ): Promise<RobustnessResult> {
    if (groups.length === 0) throw new Error('At least one symbol is required');
    // Any valid setup (the AI's proposals were already checked against its menu).
    const plan = request.plan;
    planCombos(plan.strategies, planGrid(plan)); // throws for unknown strategies/params
    parseDuration(plan.train ?? '12m');
    parseDuration(plan.test ?? '3m');

    const all = [
      ...new Set(groups.flatMap((g) => g.symbols.map((s) => s.toUpperCase()))),
    ];
    const bars = await this.backtests.fetchBars(
      all,
      request,
      infoNeeds(plan.strategies, planGrid(plan), request.newsGateTone),
    );
    const market = await this.backtests.fetchMarket(
      usesMarket(plan.strategies, planGrid(plan)),
      request,
    );
    const rows: SymbolResult[] = [];
    for (const group of groups) {
      const own = Object.fromEntries(
        group.symbols.map((s) => [
          s.toUpperCase(),
          bars[s.toUpperCase()] ?? [],
        ]),
      );
      if (Object.values(own).some((list) => list.length === 0)) {
        rows.push({
          symbol: group.label,
          error: 'no price data for this period',
        });
        continue;
      }
      try {
        const result = await this.walkForwards.run(
          {
            strategies: plan.strategies,
            grid: planGrid(plan),
            symbols: Object.keys(own),
            timeframe: request.timeframe,
            from: request.from,
            to: request.to,
            train: plan.train ?? '12m',
            test: plan.test ?? '3m',
            anchored: plan.anchored,
            sort: plan.sort,
            minTrades: plan.minTrades,
            initialCash: request.initialCash,
            slippageBps: request.slippageBps,
            feePerShare: request.feePerShare,
            cashYieldPct: request.cashYieldPct,
            newsGateTone: request.newsGateTone,
          },
          own,
          market,
        );
        const outcome = outcomeOf(result);
        rows.push({
          symbol: group.label,
          outcome,
          score: scoreOf(request.goal, outcome),
        });
      } catch (err) {
        rows.push({ symbol: group.label, error: (err as Error).message });
      }
    }
    return {
      plan,
      mode,
      goal: request.goal,
      from: request.from,
      to: request.to,
      rows,
      summary: summarize(rows, mode),
    };
  }
}

export function summarize(
  rows: SymbolResult[],
  mode: RobustnessResult['mode'] = 'symbols',
): RobustnessSummary {
  const ran = rows.filter((r) => r.outcome && r.score !== undefined);
  const beatHold = ran.filter((r) => (r.score ?? 0) > 0).length;
  const edges = ran.flatMap((r) =>
    r.outcome?.annualPct != null && r.outcome.holdAnnualPct != null
      ? [r.outcome.annualPct - r.outcome.holdAnnualPct]
      : [],
  );
  const passed = ran.length > 0 && beatHold / ran.length >= PASS_SHARE;
  const failed = rows.length - ran.length;
  return {
    tested: ran.length,
    madeMoney: ran.filter((r) => (r.outcome?.returnPct ?? 0) > 0).length,
    beatHold,
    medianScore: median(ran.map((r) => r.score ?? 0)),
    medianEdgePct: median(edges),
    passed,
    verdict:
      ran.length === 0
        ? 'It could not run on any symbol.'
        : `Better than holding on ${beatHold} of ${ran.length} ${mode === 'universes' ? 'groups' : 'symbols'}${failed ? ` (${failed} could not run)` : ''}: ${passed ? 'it works on most of them' : `it does not hold up across ${mode === 'universes' ? 'groups' : 'symbols'}`}.`,
  };
}
