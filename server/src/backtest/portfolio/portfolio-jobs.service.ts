import { Injectable } from '@nestjs/common';
import { ensureDir, portfolioReportPath } from '../jobs/report-paths.js';
import type { AiSummaryOutcome } from '../summary/ai-summary.types.js';
import { BacktestSummaryService } from '../summary/backtest-summary.service.js';
import { writePortfolioHtml } from './portfolio-html.js';
import { PortfolioService } from './portfolio.service.js';
import type { PortfolioRequest, PortfolioResult } from './portfolio.types.js';

export interface PortfolioJob {
  result: PortfolioResult;
  ai: AiSummaryOutcome | null;
  htmlPath: string | null;
}

/** Portfolio backtest → AI summary → HTML report (shared by the CLI and the API). */
@Injectable()
export class PortfolioJobsService {
  constructor(
    private readonly portfolios: PortfolioService,
    private readonly summaries: BacktestSummaryService,
  ) {}

  /** `htmlPath`: undefined = default path under reports/, null = no report. */
  async run(
    request: PortfolioRequest,
    options: { ai?: boolean; htmlPath?: string | null } = {},
  ): Promise<PortfolioJob> {
    const result = await this.portfolios.run(request);
    const ai =
      options.ai === false
        ? null
        : await this.summaries.summarizePortfolio(result);
    const htmlPath =
      options.htmlPath === undefined
        ? portfolioReportPath(
            request.sleeves.length,
            request.from,
            request.to,
            request,
          )
        : options.htmlPath;
    if (htmlPath) {
      await ensureDir(htmlPath);
      await writePortfolioHtml(
        htmlPath,
        result,
        ai && 'summary' in ai ? ai.summary : null,
      );
    }
    return { result, ai, htmlPath };
  }
}
