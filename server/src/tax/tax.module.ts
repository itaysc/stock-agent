import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { TaxController } from './api/tax.controller.js';
import {
  TaxRecordDoc,
  TaxRecordSchema,
  UsdIlsRateDoc,
  UsdIlsRateSchema,
} from './tax-record.schema.js';
import { TaxSyncService } from './tax-sync.service.js';
import { TaxService } from './tax.service.js';
import { UsdIlsService } from './usd-ils.service.js';

/** Every buy and sell kept with its shekel value, and the yearly tax report built from them. */
@Module({
  imports: [
    AlpacaModule,
    MongooseModule.forFeature([
      { name: TaxRecordDoc.name, schema: TaxRecordSchema },
      { name: UsdIlsRateDoc.name, schema: UsdIlsRateSchema },
    ]),
  ],
  controllers: [TaxController],
  providers: [UsdIlsService, TaxSyncService, TaxService],
  exports: [UsdIlsService, TaxSyncService],
})
export class TaxModule {}
