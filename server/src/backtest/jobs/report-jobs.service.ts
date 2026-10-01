import { Injectable } from '@nestjs/common';
import type { BacktestRequest } from '../backtest.service.js';
import { planContextOf } from '../plans/plan-menu.js';
import { writeHtmlReport } from '../report/html-report.js';
import {
  BacktestHistoryService,
  type HistoryRun,
} from '../runs/backtest-history.service.js';
import type { AiSummaryOutcome } from '../summary/ai-summary.types.js';
import { BacktestSummaryService } from '../summary/backtest-summary.service.js';
import { writeSweepHtml } from '../sweep/html/sweep-html.js';
import { filterMinTrades, type SortKey } from '../sweep/sweep-report.js';
import {
  type SweepRequest,
  type SweepResult,
  SweepService,
} from '../sweep/sweep.service.js';
import { writeWalkForwardHtml } from '../walkforward/html/walkforward-html.js';
import { WalkForwardService } from '../walkforward/walkforward.service.js';
import type {
  WalkForwardRequest,
  WalkForwardResult,
} from '../walkforward/walkforward.types.js';
import {
  backtestReportPath,
  ensureDir,
  sweepReportPath,
  walkForwardReportPath,
} from './report-paths.js';

/** `undefined` = default path under reports/, `null` = don't write a report. */
type HtmlPath = string | null | undefined;

export interface BacktestJob {
  run: HistoryRun;
  ai: AiSummaryOutcome | null;
  /** True when the AI summary came from the run history. */
  aiSaved: boolean;
  htmlPath: string | null;
}

export interface SweepJob {
  /** Every run, before --min-trades filtering. */
  all: SweepResult;
  result: SweepResult;
  hidden: number;
  ai: AiSummaryOutcome | null;
  htmlPath: string | null;
}

export interface WalkForwardJob {
  result: WalkForwardResult;
  ai: AiSummaryOutcome | null;
  htmlPath: string | null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const summaryOf = (ai: AiSummaryOutcome | null) =>
  ai && 'summary' in ai ? ai.summary : null;

/**
 * Backtest / sweep / walk-forward → AI summary → HTML report, shared by the CLIs and the
 * HTTP API so both behave the same.
 */
@Injectable()
export class ReportJobsService {
  constructor(
    private readonly history: BacktestHistoryService,
    private readonly summaries: BacktestSummaryService,
    private readonly sweeps: SweepService,
    private readonly walkForwards: WalkForwardService,
  ) {}

  async backtest(
    request: BacktestRequest,
    options: { fresh?: boolean; ai?: boolean; htmlPath?: HtmlPath } = {},
  ): Promise<BacktestJob> {
    const run = await this.history.run(request, { fresh: options.fresh });

    // Reuse the saved AI summary of a reused run; otherwise generate and save one.
    let ai: AiSummaryOutcome | null = null;
    const aiSaved = options.ai !== false && run.aiSummary !== null;
    if (aiSaved && run.aiSummary) {
      ai = { summary: run.aiSummary };
    } else if (options.ai !== false) {
      ai = await this.summaries.summarizeBacktest(
        run.result,
        {
          timeframe: request.timeframe,
          params: request.params ?? {},
          slippageBps: request.slippageBps,
          cashYieldPct: request.cashYieldPct,
        },
        planContextOf(request),
      );
      if ('summary' in ai)
        await this.history.saveAiSummary(run.fingerprint, ai.summary);
    }

    const htmlPath =
      options.htmlPath === undefined
        ? backtestReportPath(
            request.strategy,
            run.result.symbols,
            request.from,
            request.to,
            run.fingerprint,
          )
        : options.htmlPath;
    if (htmlPath) {
      await ensureDir(htmlPath);
      await writeHtmlReport(
        htmlPath,
        run.result,
        run.bars,
        {
          timeframe: request.timeframe,
          slippage: `${request.slippageBps} bps`,
          'cash yield': `${request.cashYieldPct ?? 0}%/yr ($${Math.round(run.result.interestEarned ?? 0).toLocaleString('en-US')} earned)`,
          ...request.params,
        },
        summaryOf(ai),
      );
    }
    return { run, ai, aiSaved, htmlPath };
  }

  async sweep(
    request: SweepRequest,
    options: {
      ai?: boolean;
      sort: SortKey;
      minTrades?: number;
      htmlPath?: HtmlPath;
    },
  ): Promise<SweepJob> {
    const all = await this.sweeps.run(request);
    const { result, hidden } = filterMinTrades(all, options.minTrades ?? 0);
    const ai =
      options.ai === false
        ? null
        : await this.summaries.summarizeSweep(
            result,
            {
              timeframe: request.timeframe,
              slippageBps: request.slippageBps,
              feePerShare: request.feePerShare,
              cashYieldPct: request.cashYieldPct,
            },
            planContextOf(request),
          );

    const htmlPath =
      options.htmlPath === undefined
        ? sweepReportPath(
            request.strategies,
            result.symbols,
            request.from,
            request.to,
            {
              ...request,
              sort: options.sort,
              minTrades: options.minTrades,
            },
          )
        : options.htmlPath;
    if (htmlPath) {
      await ensureDir(htmlPath);
      await writeSweepHtml(
        htmlPath,
        result,
        options.sort,
        {
          from: day(request.from),
          to: day(request.to),
          timeframe: request.timeframe,
        },
        summaryOf(ai),
      );
    }
    return { all, result, hidden, ai, htmlPath };
  }

  async walkForward(
    request: WalkForwardRequest,
    options: { ai?: boolean; htmlPath?: HtmlPath } = {},
  ): Promise<WalkForwardJob> {
    const result = await this.walkForwards.run(request);
    const ai =
      options.ai === false
        ? null
        : await this.summaries.summarizeWalkForward(
            result,
            planContextOf(request),
          );
    const htmlPath =
      options.htmlPath === undefined
        ? walkForwardReportPath(request)
        : options.htmlPath;
    if (htmlPath) {
      await ensureDir(htmlPath);
      await writeWalkForwardHtml(htmlPath, result, summaryOf(ai));
    }
    return { result, ai, htmlPath };
  }
}
