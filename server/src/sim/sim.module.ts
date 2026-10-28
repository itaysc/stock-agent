import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AlpacaAccountDoc,
  AlpacaAccountSchema,
} from '../accounts/alpaca-account.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaperModule } from '../paper/paper.module.js';
import { SimAccounts } from './sim-accounts.service.js';
import { SimLedger } from './sim-ledger.service.js';
import { SimMarket } from './sim-market.service.js';
import { SimScheduler } from './sim-scheduler.service.js';
import {
  SimAccountDoc,
  SimAccountSchema,
  SimActivityDoc,
  SimActivitySchema,
  SimOrderDoc,
  SimOrderSchema,
} from './sim.schema.js';

/** Bullwether paper accounts: virtual cash, real prices, simulated fills (no Alpaca account needed). */
@Module({
  imports: [
    AuthModule,
    PaperModule,
    MongooseModule.forFeature([
      { name: AlpacaAccountDoc.name, schema: AlpacaAccountSchema },
      { name: SimAccountDoc.name, schema: SimAccountSchema },
      { name: SimOrderDoc.name, schema: SimOrderSchema },
      { name: SimActivityDoc.name, schema: SimActivitySchema },
    ]),
  ],
  providers: [SimAccounts, SimLedger, SimMarket, SimScheduler],
  exports: [SimAccounts, SimLedger, SimScheduler],
})
export class SimModule {}
