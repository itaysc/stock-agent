import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlpacaModule } from '../alpaca/alpaca.module.js';
import { RiskModule } from '../risk/risk.module.js';
import { OrderEvent, OrderEventSchema } from './order-event.schema.js';
import { OrderLogService } from './order-log.service.js';
import { Order, OrderSchema } from './order.schema.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [
    AlpacaModule,
    RiskModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderEvent.name, schema: OrderEventSchema },
    ]),
  ],
  providers: [OrderLogService, OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
