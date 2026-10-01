import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BacktestModule } from '../backtest/backtest.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { ResearchAgent } from './research-agent.service.js';
import { ResearchRun, ResearchRunSchema } from './research-run.schema.js';
import { ResearchService } from './research.service.js';
import { RobustnessService } from './robustness/robustness.service.js';

@Module({
  imports: [
    BacktestModule,
    LlmModule,
    MongooseModule.forFeature([
      { name: ResearchRun.name, schema: ResearchRunSchema },
    ]),
  ],
  providers: [ResearchAgent, ResearchService, RobustnessService],
  exports: [ResearchService, RobustnessService],
})
export class ResearchModule {}
