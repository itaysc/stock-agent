import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaperModule } from '../paper/paper.module.js';
import { TradeModule } from '../trade/trade.module.js';
import { AccountInterceptor } from './account.interceptor.js';
import { AccountsService } from './accounts.service.js';
import {
  AlpacaAccountDoc,
  AlpacaAccountSchema,
} from './alpaca-account.schema.js';
import { AccountsController } from './api/accounts.controller.js';

/** The Accounts API, and the account every API request runs in. */
@Module({
  imports: [
    AlpacaModule,
    AuthModule,
    PaperModule,
    TradeModule,
    MongooseModule.forFeature([
      { name: AlpacaAccountDoc.name, schema: AlpacaAccountSchema },
    ]),
  ],
  controllers: [AccountsController],
  providers: [
    AccountsService,
    { provide: APP_INTERCEPTOR, useClass: AccountInterceptor },
  ],
})
export class AccountsModule {}
