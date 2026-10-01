import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * Our own statuses on top of Alpaca's order statuses (new, filled, canceled, ...):
 * - pending_submit: intent saved, request to Alpaca not answered yet
 * - submit_failed: Alpaca rejected the request (the order does not exist)
 * - unknown: network failed mid-request and the order could not be found;
 *   it may still exist, so it needs reconciling before placing again
 * - risk_rejected: blocked by the risk checks, never sent to Alpaca
 */
export type LocalOrderStatus =
  'pending_submit' | 'submit_failed' | 'unknown' | 'risk_rejected';

/** Who created the order: this server, or anything else on the account (e.g. the Alpaca dashboard). */
export type OrderSource = 'app' | 'external';

/**
 * One document per order, keyed by `clientOrderId`. Amounts are stored as the
 * exact decimal strings Alpaca uses, never floats.
 */
@Schema({ collection: 'orders', timestamps: true })
export class Order {
  @Prop({ type: String, required: true, unique: true })
  clientOrderId: string;

  @Prop({ type: String, index: true, sparse: true })
  alpacaOrderId?: string;

  @Prop({ type: String, required: true, index: true })
  status: string;

  @Prop({ type: Boolean, required: true })
  paper: boolean;

  @Prop({ type: String, required: true, enum: ['app', 'external'] })
  source: OrderSource;

  @Prop({ type: String, required: true, index: true })
  symbol: string;

  @Prop({ type: String })
  side?: string;

  @Prop({ type: String })
  type?: string;

  @Prop({ type: String })
  timeInForce?: string;

  @Prop({ type: String })
  qty?: string;

  @Prop({ type: String })
  notional?: string;

  @Prop({ type: String })
  limitPrice?: string;

  @Prop({ type: String })
  stopPrice?: string;

  @Prop({ type: String })
  filledQty?: string;

  @Prop({ type: String })
  filledAvgPrice?: string;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: String })
  error?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
