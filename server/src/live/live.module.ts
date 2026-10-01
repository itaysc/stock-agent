import { Module } from '@nestjs/common';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { StrategyRunnerService } from './strategy-runner.service.js';

@Module({
  imports: [AlpacaModule, OrdersModule],
  providers: [StrategyRunnerService],
  exports: [StrategyRunnerService],
})
export class LiveModule {}
