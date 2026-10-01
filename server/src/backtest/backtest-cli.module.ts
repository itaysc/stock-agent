import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ResearchModule } from '../research/research.module.js';
import { BacktestModule } from './backtest.module.js';

/** Minimal app for the backtest and research CLIs: config, MongoDB, Alpaca REST, LLM. No HTTP server, no streams. */
@Module({
  imports: [AppConfigModule, DatabaseModule, BacktestModule, ResearchModule],
})
export class BacktestCliModule {}
