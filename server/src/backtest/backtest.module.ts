import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { InfoModule } from '../info/info.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { BacktestService } from './backtest.service.js';
import { ReportJobsService } from './jobs/report-jobs.service.js';
import { PortfolioJobsService } from './portfolio/portfolio-jobs.service.js';
import { PortfolioService } from './portfolio/portfolio.service.js';
import { BacktestRun, BacktestRunSchema } from './runs/backtest-run.schema.js';
import { BacktestHistoryService } from './runs/backtest-history.service.js';
import { BacktestSummaryService } from './summary/backtest-summary.service.js';
import { SweepService } from './sweep/sweep.service.js';
import { WalkForwardService } from './walkforward/walkforward.service.js';

@Module({
  imports: [
    AlpacaModule,
    InfoModule,
    LlmModule,
    MongooseModule.forFeature([
      { name: BacktestRun.name, schema: BacktestRunSchema },
    ]),
  ],
  providers: [
    BacktestService,
    BacktestHistoryService,
    SweepService,
    WalkForwardService,
    BacktestSummaryService,
    ReportJobsService,
    PortfolioService,
    PortfolioJobsService,
  ],
  exports: [
    BacktestService,
    BacktestHistoryService,
    SweepService,
    WalkForwardService,
    BacktestSummaryService,
    ReportJobsService,
    PortfolioService,
    PortfolioJobsService,
  ],
})
export class BacktestModule {}
