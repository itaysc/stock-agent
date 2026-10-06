import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { EarningsDoc, EarningsSchema } from './earnings.schema.js';
import { EarningsService } from './earnings.service.js';
import { InfoService } from './info.service.js';
import { NewsMonth, NewsMonthSchema } from './news.schema.js';
import { NewsService } from './news.service.js';
import { EdgarService } from './official/edgar.service.js';
import { HaltsService } from './official/halts.service.js';

/** Market information beyond prices: news tone and earnings (cached in MongoDB). */
@Module({
  imports: [
    AlpacaModule,
    MongooseModule.forFeature([
      { name: NewsMonth.name, schema: NewsMonthSchema },
      { name: EarningsDoc.name, schema: EarningsSchema },
    ]),
  ],
  providers: [
    NewsService,
    EarningsService,
    InfoService,
    HaltsService,
    EdgarService,
  ],
  exports: [InfoService, HaltsService, EdgarService, EarningsService],
})
export class InfoModule {}
