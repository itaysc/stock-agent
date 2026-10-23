import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AlpacaAccountDoc,
  AlpacaAccountSchema,
} from '../accounts/alpaca-account.schema.js';
import { AlpacaAccounts } from '../accounts/alpaca-accounts.service.js';
import {
  ALPACA_CLIENT,
  ALPACA_CLIENT_FACTORY,
  ALPACA_STREAM_OPTIONS,
} from './alpaca.constants.js';
import { AlpacaStreamService } from './alpaca-stream.service.js';
import { AlpacaService } from './alpaca.service.js';
import { MarketController } from './api/market.controller.js';

/** Global: every module may need the accounts (AlpacaAccounts) for its per-account work. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AlpacaAccountDoc.name, schema: AlpacaAccountSchema },
    ]),
  ],
  controllers: [MarketController],
  providers: [
    // Test hooks (see alpaca.constants.ts): real clients in the app.
    { provide: ALPACA_CLIENT, useValue: null },
    { provide: ALPACA_CLIENT_FACTORY, useValue: null },
    { provide: ALPACA_STREAM_OPTIONS, useValue: {} },
    AlpacaAccounts,
    AlpacaService,
    AlpacaStreamService,
  ],
  exports: [AlpacaAccounts, AlpacaService, AlpacaStreamService],
})
export class AlpacaModule {}
