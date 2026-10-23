import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import {
  MyStocksDoc,
  MyStocksSchema,
  MyStocksStore,
} from './my-stocks.store.js';

/** Your own stocks' ledger, on its own so the paper module can read it (to keep the two apart) without a cycle. */
@Module({
  imports: [
    AlpacaModule,
    MongooseModule.forFeature([
      { name: MyStocksDoc.name, schema: MyStocksSchema },
    ]),
  ],
  providers: [MyStocksStore],
  exports: [MyStocksStore],
})
export class MyStocksStoreModule {}
