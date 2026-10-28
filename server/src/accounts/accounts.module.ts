import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaperModule } from '../paper/paper.module.js';
import { SimModule } from '../sim/sim.module.js';
import { TradeModule } from '../trade/trade.module.js';
import { AccountInterceptor } from './account.interceptor.js';
import { AccountsService } from './accounts.service.js';
import {
  AlpacaAccountDoc,
  AlpacaAccountSchema,
} from './alpaca-account.schema.js';
import { AccountsController } from './api/accounts.controller.js';
import { LoginSyncService } from './login-sync.service.js';
import { AlpacaOAuthController } from './oauth/alpaca-oauth.controller.js';
import { AlpacaOAuthService } from './oauth/alpaca-oauth.service.js';
import {
  AlpacaSignupDoc,
  AlpacaSignupSchema,
} from './oauth/alpaca-signup.schema.js';

/** The Accounts API, Log in / Connect with Alpaca, and the account every API request runs in. */
@Module({
  imports: [
    AlpacaModule,
    AuthModule,
    PaperModule,
    SimModule,
    TradeModule,
    MongooseModule.forFeature([
      { name: AlpacaAccountDoc.name, schema: AlpacaAccountSchema },
      { name: AlpacaSignupDoc.name, schema: AlpacaSignupSchema },
    ]),
  ],
  controllers: [AccountsController, AlpacaOAuthController],
  providers: [
    AccountsService,
    AlpacaOAuthService,
    LoginSyncService,
    { provide: APP_INTERCEPTOR, useClass: AccountInterceptor },
  ],
})
export class AccountsModule {}
