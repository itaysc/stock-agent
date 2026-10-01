import { Module } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module.js';
import { BacktestModule } from '../backtest.module.js';
import { PortfoliosController } from '../portfolio/portfolios.controller.js';
import { BacktestsController } from './backtests.controller.js';

/** HTTP API for the backtest UI (kept out of the CLI app). */
@Module({
  imports: [BacktestModule, LlmModule],
  controllers: [BacktestsController, PortfoliosController],
})
export class BacktestApiModule {}
