import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { InfoModule } from '../info/info.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { NotifyModule } from '../notify/notify.module.js';
import { BacktestModule } from '../backtest/backtest.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ResearchModule } from '../research/research.module.js';
import { MyStocksStoreModule } from '../trade/my-stocks-store.module.js';
import { DeploymentsController } from './api/deployments.controller.js';
import { DeploymentRunnerService } from './deployment-runner.service.js';
import { DeploymentStore } from './deployment-store.js';
import { DeploymentRun, DeploymentRunSchema } from './deployment.schema.js';
import { DeploymentsService } from './deployments.service.js';
import { PositionActionsService } from './position-actions.service.js';
import { SlotActionsService } from './slot-actions.service.js';

/** Paper trading: deployments of daily strategies on the paper account. */
@Module({
  imports: [
    AlpacaModule,
    InfoModule,
    LlmModule,
    NotifyModule,
    OrdersModule,
    BacktestModule,
    ResearchModule,
    MyStocksStoreModule,
    MongooseModule.forFeature([
      { name: DeploymentRun.name, schema: DeploymentRunSchema },
    ]),
  ],
  controllers: [DeploymentsController],
  providers: [
    DeploymentStore,
    DeploymentRunnerService,
    DeploymentsService,
    PositionActionsService,
    SlotActionsService,
  ],
  exports: [
    DeploymentStore,
    DeploymentsService,
    PositionActionsService,
    SlotActionsService,
  ],
})
export class PaperModule {}
