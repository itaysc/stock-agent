import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { BacktestModule } from '../backtest/backtest.module.js';
import { NotifyModule } from '../notify/notify.module.js';
import { PaperModule } from '../paper/paper.module.js';
import { BrokerController } from './api/broker.controller.js';
import { BrokerSchedulerService } from './broker-scheduler.service.js';
import {
  BrokerStateDoc,
  BrokerStateSchema,
  BrokerStore,
} from './broker-store.js';
import { BrokerService } from './broker.service.js';

/** The broker: picks stocks and trades them by itself (paper), reports daily. */
@Module({
  imports: [
    AlpacaModule,
    PaperModule,
    BacktestModule,
    NotifyModule,
    MongooseModule.forFeature([
      { name: BrokerStateDoc.name, schema: BrokerStateSchema },
    ]),
  ],
  controllers: [BrokerController],
  providers: [BrokerStore, BrokerService, BrokerSchedulerService],
  exports: [BrokerService],
})
export class BrokerModule {}
