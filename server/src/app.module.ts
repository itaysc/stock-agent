import { Module } from '@nestjs/common';
import { AlpacaModule } from './alpaca/alpaca.module.js';
import { BacktestApiModule } from './backtest/api/backtest-api.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AutopilotModule } from './autopilot/autopilot.module.js';
import { BrokerModule } from './broker/broker.module.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { LiveModule } from './live/live.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaperModule } from './paper/paper.module.js';
import { ResearchApiModule } from './research/api/research-api.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    AuthModule,
    DatabaseModule,
    HealthModule,
    AlpacaModule,
    OrdersModule,
    LiveModule,
    BacktestApiModule,
    ResearchApiModule,
    PaperModule,
    AutopilotModule,
    BrokerModule,
  ],
})
export class AppModule {}
