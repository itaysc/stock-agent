import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Shares of one stock in a Bullwether paper account. */
export interface SimPosition {
  symbol: string;
  qty: number;
  /** What the shares cost in total (USD), for the average price. */
  costBasis: number;
}

/**
 * A Bullwether paper account: virtual cash and stocks, kept by Bullwether
 * (no Alpaca account behind it). Its id is also its `alpaca_accounts` id.
 */
@Schema({ collection: 'sim_accounts', timestamps: true })
export class SimAccountDoc {
  /** e.g. BW7K2M9QXA */
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  owner!: string;

  /** USD. */
  @Prop({ required: true })
  cash!: number;

  @Prop({ required: true })
  startingCash!: number;

  @Prop({
    type: [{ symbol: String, qty: Number, costBasis: Number, _id: false }],
    default: [],
  })
  positions!: SimPosition[];

  /** The account's value at the last close (for the day's change). */
  @Prop({ required: true })
  lastEquity!: number;

  /** The trading day `lastEquity` is from (YYYY-MM-DD). */
  @Prop({ type: String })
  lastEquityDay?: string;

  /** Corporate actions (splits, dividends) already applied, by Alpaca's id. */
  @Prop({ type: [String], default: [] })
  appliedActions!: string[];

  /** Bumped by every change to cash or positions: a change applies only to the version it read. */
  @Prop({ type: Number, default: 0 })
  rev!: number;
}
export const SimAccountSchema = SchemaFactory.createForClass(SimAccountDoc);

export type SimOrderStatus = 'accepted' | 'filled' | 'canceled' | 'rejected';

/** An order in a Bullwether paper account (market orders only, as the app places). */
@Schema({ collection: 'sim_orders' })
export class SimOrderDoc {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true })
  accountId!: string;

  @Prop({ type: String, required: true })
  clientOrderId!: string;

  @Prop({ type: String, required: true })
  symbol!: string;

  @Prop({ type: String, required: true, enum: ['buy', 'sell'] })
  side!: 'buy' | 'sell';

  @Prop({ type: Number })
  qty?: number;

  @Prop({ type: Number })
  notional?: number;

  @Prop({ type: String, required: true })
  timeInForce!: string;

  @Prop({ type: String, required: true, index: true })
  status!: SimOrderStatus;

  /** Cash held for a waiting buy (USD), so waiting orders can't overspend. */
  @Prop({ type: Number, default: 0 })
  reserved!: number;

  @Prop({ type: Number, default: 0 })
  filledQty!: number;

  @Prop({ type: Number })
  filledAvgPrice?: number;

  @Prop({ type: Date, required: true })
  submittedAt!: Date;

  @Prop({ type: Date })
  filledAt?: Date;

  @Prop({ type: Date })
  canceledAt?: Date;

  /** Why it wasn't filled. */
  @Prop({ type: String })
  reason?: string;
}
export const SimOrderSchema = SchemaFactory.createForClass(SimOrderDoc);
SimOrderSchema.index({ accountId: 1, clientOrderId: 1 }, { unique: true });
SimOrderSchema.index({ accountId: 1, submittedAt: -1 });

/**
 * A fill or a dividend in a Bullwether paper account, as Alpaca's account
 * activities API returns it (snake_case), for the tax records.
 */
@Schema({ collection: 'sim_activities' })
export class SimActivityDoc {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true })
  accountId!: string;

  @Prop({ type: Date, required: true })
  at!: Date;

  @Prop({ type: Object, required: true })
  row!: Record<string, string>;
}
export const SimActivitySchema = SchemaFactory.createForClass(SimActivityDoc);
SimActivitySchema.index({ accountId: 1, at: 1 });
