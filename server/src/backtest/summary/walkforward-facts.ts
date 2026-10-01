import { paramsText } from '../sweep/sweep-report.js';
import { walkForwardSetup } from '../walkforward/walkforward-report.js';
import type { WalkForwardResult } from '../walkforward/walkforward.types.js';

const pct = (n: number | null | undefined) =>
  n === null || n === undefined ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Fact sheet for the AI summary of a walk-forward test. */
export function walkForwardFacts(r: WalkForwardResult): string {
  const m = r.metrics;
  return [
    'Walk-forward test: for each window the best setting is picked on the training period, then traded on the next, unseen test period. Only the test periods count. Open positions are sold at the end of every test window, so nothing is left open or unrealized.',
    `Costs: slippage ${r.slippageBps} bps per fill, fee $${r.feePerShare} per share. Idle cash earns ${r.cashYieldPct}% a year: $${Math.round(r.interestEarned).toLocaleString('en-US')} earned in the test windows (included in the return)`,
    `Strategies: ${r.strategies.join(', ')} | symbols ${r.symbols.join(', ')} | timeframe ${r.timeframe} | ${walkForwardSetup(r)}`,
    `Unseen (out-of-sample) span: ${day(r.oosFrom)} to ${day(r.oosTo)}, ${r.windows.length} windows`,
    `Out-of-sample return: ${pct(m.totalReturnPct)} | equal-weight buy & hold, same span: ${pct(m.buyAndHoldReturnPct)}`,
    `Annualized: ${pct(r.outOfSampleAnnualPct)} out-of-sample vs ${pct(r.inSampleAnnualPct)} average in training`,
    `Walk-forward efficiency (out-of-sample ÷ in-sample annual return): ${r.efficiencyPct === null ? 'n/a' : `${r.efficiencyPct.toFixed(0)}%`}`,
    `Out-of-sample max drawdown: ${m.maxDrawdownPct.toFixed(2)}% | closed trades ${m.trades} | win rate ${pct(m.winRatePct).replace('+', '')} | profit factor ${m.profitFactor?.toFixed(2) ?? 'n/a'}`,
    `Chosen setting changed ${r.paramChanges} times; ${r.distinctSettings} distinct settings used`,
    'Windows (training pick → test result):',
    ...r.windows.map(
      (w) =>
        `#${w.index} train ${day(w.trainFrom)}..${day(w.trainTo)} picked ${w.chosen ? `${w.chosen.strategy} ${paramsText(w.chosen.params)} (train ${pct(w.chosen.trainReturnPct)}, ${w.chosen.trainTrades} trades)` : 'nothing'} → test ${day(w.testFrom)}..${day(w.testTo)}: ${pct(w.test?.returnPct)}, ${w.test?.trades ?? 0} trades, buy & hold ${pct(w.test?.buyAndHoldReturnPct)}`,
    ),
  ].join('\n');
}
