import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Append-only log of every trade update Alpaca sends for an order. */
@Schema({
  collection: 'order_events',
  timestamps: { createdAt: true, updatedAt: false },
})
export class OrderEvent {
  @Prop({ type: String, required: true })
  clientOrderId: string;

  @Prop({ type: String })
  alpacaOrderId?: string;

  /** new, fill, partial_fill, canceled, rejected, expired, ... */
  @Prop({ type: String, required: true })
  event: string;

  /** Order status right after this event. */
  @Prop({ type: String })
  status?: string;

  /** When Alpaca says the event happened. */
  @Prop({ type: Date })
  timestamp?: Date;

  /** Fill price/qty for fill and partial_fill events. */
  @Prop({ type: String })
  price?: string;

  @Prop({ type: String })
  qty?: string;

  /** Position size after the fill. */
  @Prop({ type: String })
  positionQty?: string;

  @Prop({ type: String })
  executionId?: string;

  createdAt: Date;
}

export type OrderEventDocument = HydratedDocument<OrderEvent>;
export const OrderEventSchema = SchemaFactory.createForClass(OrderEvent);
OrderEventSchema.index({ clientOrderId: 1, timestamp: 1 });
