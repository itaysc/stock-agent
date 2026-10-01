import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { mapErrors } from '../api/map-errors.js';
import { resolvePeriod } from '../backtest-cli.helpers.js';
import { reportUrl } from '../jobs/report-paths.js';
import { PortfolioJobsService } from './portfolio-jobs.service.js';
import { RunPortfolioDto } from './portfolio.dto.js';

@ApiTags('backtests')
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly jobs: PortfolioJobsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Portfolio backtest: several strategies with their own symbols and share of the money',
  })
  async run(@Body() dto: RunPortfolioDto) {
    const { from, to } = resolvePeriod(dto.from, dto.to, 5);
    const job = await mapErrors(() =>
      this.jobs.run(
        {
          sleeves: dto.sleeves.map((s) => ({
            strategy: s.strategy,
            symbols: s.symbols,
            weightPct: s.weightPct,
            params: Object.fromEntries(
              Object.entries(s.params ?? {}).map(([k, v]) => [k, String(v)]),
            ),
          })),
          risk: {
            maxDrawdownPct: dto.maxDrawdownPct,
            cooldownDays: dto.cooldownDays,
          },
          timeframe: dto.timeframe,
          from: new Date(from),
          to: new Date(to),
          initialCash: dto.cash,
          slippageBps: dto.slippageBps,
          feePerShare: dto.feePerShare,
          cashYieldPct: dto.cashYieldPct,
          newsGateTone: dto.newsGateTone,
        },
        { ai: dto.ai },
      ),
    );
    const r = job.result;
    return {
      kind: 'portfolio' as const,
      reportUrl: job.htmlPath ? reportUrl(job.htmlPath) : null,
      from: r.from ?? null,
      to: r.to ?? null,
      initialCash: r.initialCash,
      finalEquity: r.finalEquity,
      metrics: r.metrics,
      benchmarkReturnPct: r.benchmarkReturnPct,
      benchmarkMaxDrawdownPct: r.benchmarkMaxDrawdownPct,
      interestEarned: r.interestEarned,
      reserve: r.reserve,
      sleeves: r.sleeves.map((s) => ({
        label: s.label,
        sleeve: s.sleeve,
        allocated: s.allocated,
        finalEquity: s.result.finalEquity,
        contribution: s.contribution,
        returnPct: s.result.metrics.totalReturnPct,
        holdReturnPct: s.holdReturnPct,
        maxDrawdownPct: s.result.metrics.maxDrawdownPct,
        trades: s.result.metrics.trades,
      })),
      correlation: r.correlation,
      stops: r.stops,
      risk: r.risk,
      aiSummary: job.ai && 'summary' in job.ai ? job.ai.summary : null,
      aiSkipped: job.ai && 'skipped' in job.ai ? job.ai.skipped : null,
    };
  }
}
