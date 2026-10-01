import type { WalkForwardService } from '../backtest/walkforward/walkforward.service.js';
import { outcomeOf } from '../research/research-score.js';
import { BROKER_STOCKS, SAFE_ASSET } from './universe.js';

const YEAR_MS = 365.25 * 86_400_000;
const signed = (n: number | null) =>
  n === null ? 'n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

/**
 * The monthly health check: the broker's fixed settings over the last 3
 * years (after a 2-year warm-up), vs holding the stocks. It never changes
 * the settings (in the algo lab, re-tuning every 6 months did worse than
 * keeping the classic ones); it warns you when the method stops working.
 */
export async function healthCheck(
  walkForwards: WalkForwardService,
  params: Record<string, string>,
  capital: number,
  now = new Date(),
): Promise<{ ok: boolean; message: string }> {
  const result = await walkForwards.run({
    strategies: ['momentum-rotation'],
    grid: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, [v]])),
    symbols: [...BROKER_STOCKS, SAFE_ASSET],
    timeframe: '1Day',
    from: new Date(now.getTime() - 5 * YEAR_MS),
    to: now,
    train: '2y',
    test: '6m',
    sort: 'return-dd',
    initialCash: capital,
    slippageBps: 5,
    feePerShare: 0,
    cashYieldPct: 3,
  });
  const o = outcomeOf(result);
  const evidence = `last ${Math.round(o.windows / 2)} years: ${signed(o.returnPct)} vs ${signed(o.holdReturnPct)} holding all the stocks, worst drop -${o.maxDrawdownPct.toFixed(1)}%`;
  const ok = o.holdReturnPct === null || o.returnPct > o.holdReturnPct;
  return {
    ok,
    message: ok
      ? `Monthly check: the algo still works (${evidence}).`
      : `⚠️ Monthly check: the algo trailed just holding the stocks (${evidence}). Consider pausing it.`,
  };
}
