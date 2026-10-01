import type { AiSummary } from '../../summary/ai-summary.types.js';
import { median, paramsText, type SortKey, sortRows } from '../sweep-report.js';
import type { SweepResult } from '../sweep.service.js';

export const TOP_CURVES = 5;

export interface SweepRunView {
  id: number;
  rank: number;
  strategy: string;
  params: Record<string, string>;
  label: string;
  returnPct: number;
  maxDrawdownPct: number;
  trades: number;
  winRatePct: number | null;
  profitFactor: number | null;
  finalEquity: number;
  beatHold: boolean;
  /** The `npm run report` command that opens this run as a visual report. */
  command: string;
}

export interface StrategySummary {
  strategy: string;
  runs: number;
  medianReturnPct: number | null;
  positive: number;
  beatHold: number;
  bestReturnPct: number | null;
}

export interface SweepHtmlData {
  symbols: string[];
  from: string | null;
  to: string | null;
  bars: number;
  timeframe: string;
  sort: SortKey;
  buyAndHoldReturnPct: number | null;
  skipped: number;
  aiSummary: AiSummary | null;
  summaries: StrategySummary[];
  /** All runs, ranked by `sort`. */
  runs: SweepRunView[];
  curves: {
    times: number[];
    buyAndHold: number[];
    top: Array<{ id: number; label: string; values: number[] }>;
  };
}

export interface CommandContext {
  from: string;
  to: string;
  timeframe: string;
}

export function reportCommand(
  symbols: string[],
  strategy: string,
  params: Record<string, string>,
  ctx: CommandContext,
): string {
  const flags = Object.entries(params)
    .map(([k, v]) => ` --param ${k}=${v}`)
    .join('');
  return (
    `npm run report -- ${symbols.join(' ')} --strategy ${strategy}${flags}` +
    ` --from ${ctx.from} --to ${ctx.to} --timeframe ${ctx.timeframe}`
  );
}

export function buildSweepHtmlData(
  result: SweepResult,
  sort: SortKey,
  ctx: CommandContext,
  aiSummary: AiSummary | null = null,
): SweepHtmlData {
  const hold = result.buyAndHoldReturnPct;
  const ranked = sortRows(result.rows, sort);
  const runs: SweepRunView[] = ranked.map((row, i) => ({
    id: i,
    rank: i + 1,
    strategy: row.strategy,
    params: row.params,
    label: `${row.strategy} ${paramsText(row.params)}`,
    returnPct: row.metrics.totalReturnPct,
    maxDrawdownPct: row.metrics.maxDrawdownPct,
    trades: row.metrics.trades,
    winRatePct: row.metrics.winRatePct,
    profitFactor: row.metrics.profitFactor,
    finalEquity: row.finalEquity,
    beatHold: hold !== null && row.metrics.totalReturnPct > hold,
    command: reportCommand(result.symbols, row.strategy, row.params, ctx),
  }));

  const summaries = [...new Set(runs.map((r) => r.strategy))].map(
    (strategy) => {
      const own = runs.filter((r) => r.strategy === strategy);
      const returns = own.map((r) => r.returnPct);
      return {
        strategy,
        runs: own.length,
        medianReturnPct: median(returns),
        positive: returns.filter((r) => r > 0).length,
        beatHold: own.filter((r) => r.beatHold).length,
        bestReturnPct: returns.length ? Math.max(...returns) : null,
      };
    },
  );

  const seconds = (d: Date) => Math.floor(d.getTime() / 1000);
  return {
    symbols: result.symbols,
    from: result.from?.toISOString() ?? null,
    to: result.to?.toISOString() ?? null,
    bars: result.bars,
    timeframe: ctx.timeframe,
    sort,
    buyAndHoldReturnPct: hold,
    skipped: result.skipped.length,
    aiSummary,
    summaries,
    runs,
    curves: {
      times: result.timestamps.map(seconds),
      buyAndHold: result.buyAndHold,
      top: ranked.slice(0, TOP_CURVES).map((row, i) => ({
        id: i,
        label: runs[i].label,
        values: row.equity,
      })),
    },
  };
}
