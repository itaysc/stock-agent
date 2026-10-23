import { Module } from '@nestjs/common';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { BacktestModule } from '../backtest/backtest.module.js';
import { InfoModule } from '../info/info.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { NotifyModule } from '../notify/notify.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PaperModule } from '../paper/paper.module.js';
import { TaxModule } from '../tax/tax.module.js';
import { TradeController } from './api/trade.controller.js';
import { AlpacaSyncService } from './alpaca-sync.service.js';
import { AssetsService } from './assets.service.js';
import { MyStocksRunner } from './my-stocks-runner.service.js';
import { MyStocksStoreModule } from './my-stocks-store.module.js';
import { MyStocksService } from './my-stocks.service.js';
import { TradeService } from './trade.service.js';

/** The Trade page: search, charts, your own buys and sells, watchlist, discovery and news summaries. */
@Module({
  imports: [
    AlpacaModule,
    BacktestModule,
    InfoModule,
    LlmModule,
    NotifyModule,
    OrdersModule,
    PaperModule,
    MyStocksStoreModule,
    TaxModule,
  ],
  controllers: [TradeController],
  providers: [
    AlpacaSyncService,
    AssetsService,
    MyStocksService,
    MyStocksRunner,
    TradeService,
  ],
  exports: [AlpacaSyncService],
})
export class TradeModule {}
