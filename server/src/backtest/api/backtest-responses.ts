import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  BacktestJob,
  SweepJob,
  WalkForwardJob,
} from '../jobs/report-jobs.service.js';
import { maxDrawdownPct } from '../backtest-metrics.js';
import { REPORTS_DIR, reportUrl } from '../jobs/report-paths.js';
import { buyAndHoldCurve } from '../report/report-data.js';
import { buildSweepHtmlData } from '../sweep/html/sweep-html-data.js';
import type { SortKey } from '../sweep/sweep-report.js';
import { walkForwardSetup } from '../walkforward/walkforward-report.js';

/** Worst fall from a peak of a buy & hold curve, in percent. */
const holdDrawdown = (values: number[], times: Date[]) =>
  maxDrawdownPct(values.map((equity, i) => ({ timestamp: times[i], equity })));

const aiFields = (ai: BacktestJob['ai']) => ({
  aiSummary: ai && 'summary' in ai ? ai.summary : null,
  aiSkipped: ai && 'skipped' in ai ? ai.skipped : null,
});

export function backtestResponse(job: BacktestJob) {
  const { result, status } = job.run;
  return {
    kind: 'backtest' as const,
    reportUrl: job.htmlPath ? reportUrl(job.htmlPath) : null,
    history: status,
    strategy: result.strategy,
    symbols: result.symbols,
    from: result.from ?? null,
    to: result.to ?? null,
    bars: result.bars,
    initialCash: result.initialCash,
    finalEquity: result.finalEquity,
    interestEarned: result.interestEarned ?? 0,
    metrics: result.metrics,
    holdMaxDrawdownPct: holdDrawdown(
      buyAndHoldCurve(
        job.run.bars,
        result.initialCash,
        result.equityCurve.map((p) => p.timestamp),
      ),
      result.equityCurve.map((p) => p.timestamp),
    ),
    openPositions: result.openPositions,
    rejections: result.rejections.length,
    ...aiFields(job.ai),
    aiSaved: job.aiSaved,
  };
}

export function sweepResponse(
  job: SweepJob,
  sort: SortKey,
  ctx: { from: string; to: string; timeframe: string },
  initialCash: number,
) {
  const data = buildSweepHtmlData(job.result, sort, ctx);
  return {
    kind: 'sweep' as const,
    reportUrl: job.htmlPath ? reportUrl(job.htmlPath) : null,
    symbols: job.result.symbols,
    from: job.result.from ?? null,
    to: job.result.to ?? null,
    bars: job.result.bars,
    runs: job.result.rows.length,
    hidden: job.hidden,
    skipped: job.result.skipped.length,
    buyAndHoldReturnPct: job.result.buyAndHoldReturnPct,
    holdMaxDrawdownPct: holdDrawdown(
      job.result.buyAndHold,
      job.result.timestamps,
    ),
    initialCash,
    summaries: data.summaries,
    top: data.runs.slice(0, 5).map(({ command: _c, ...run }) => run),
    ...aiFields(job.ai),
  };
}

export function walkForwardResponse(job: WalkForwardJob) {
  const r = job.result;
  return {
    kind: 'walkforward' as const,
    reportUrl: job.htmlPath ? reportUrl(job.htmlPath) : null,
    strategies: r.strategies,
    symbols: r.symbols,
    setup: walkForwardSetup(r),
    oosFrom: r.oosFrom,
    oosTo: r.oosTo,
    initialCash: r.initialCash,
    finalEquity: r.finalEquity,
    interestEarned: r.interestEarned,
    cashYieldPct: r.cashYieldPct,
    metrics: r.metrics,
    holdMaxDrawdownPct: holdDrawdown(
      r.buyAndHold,
      r.equityCurve.map((p) => p.timestamp),
    ),
    inSampleAnnualPct: r.inSampleAnnualPct,
    outOfSampleAnnualPct: r.outOfSampleAnnualPct,
    efficiencyPct: r.efficiencyPct,
    paramChanges: r.paramChanges,
    distinctSettings: r.distinctSettings,
    windows: r.windows.map(({ candidates: _c, qualified: _q, ...w }) => w),
    ...aiFields(job.ai),
  };
}

/**
 * Reads "<strategy>_<SYMBOLS>_<from>_<to>_<hash>.html" or
 * "sweep_<a+b>_<SYMBOLS>_<from>_<to>_<hash>.html" / "walkforward_..." / "research_..." (older
 * names may lack parts).
 */
export function parseReportName(name: string) {
  const parts = name.replace(/\.html$/, '').split('_');
  if (parts[0] === 'research') {
    // research_<SYMBOLS>_<started>_<id>
    return {
      kind: 'research' as const,
      strategy: 'AI research agent',
      symbols: parts[1] ? parts[1].split('-') : [],
      period: parts[2] ? `started ${parts[2]}` : null,
    };
  }
  const kind =
    parts[0] === 'sweep' || parts[0] === 'walkforward' ? parts[0] : null;
  if (parts[0] === 'portfolio') {
    // portfolio_<n>-sleeves_<from>_<to>_<hash>
    return {
      kind: 'portfolio' as const,
      strategy: (parts[1] ?? '').replace('-', ' '),
      symbols: [],
      period: parts[2] && parts[3] ? `${parts[2]} → ${parts[3]}` : null,
    };
  }
  const [strategy = name, symbols = '', from, to] = kind
    ? parts.slice(1)
    : parts;
  return {
    kind: kind ?? ('backtest' as const),
    strategy: strategy.replaceAll('+', ', '),
    symbols: symbols ? symbols.split('-') : [],
    period: from && to ? `${from} → ${to}` : null,
  };
}

/** Most recent HTML reports on disk, newest first. */
export async function listReports(limit = 30) {
  const names = await readdir(REPORTS_DIR).catch(() => [] as string[]);
  const reports = await Promise.all(
    names
      .filter((n) => n.endsWith('.html'))
      .map(async (name) => {
        const info = await stat(join(REPORTS_DIR, name));
        return {
          name,
          url: reportUrl(name),
          ...parseReportName(name),
          createdAt: info.mtime,
          sizeKb: Math.round(info.size / 1024),
        };
      }),
  );
  return reports
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
