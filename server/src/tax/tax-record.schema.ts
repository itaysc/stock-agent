import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { TaxKind } from './activity-map.js';

/**
 * One account activity kept for the yearly tax report: every buy and sell
 * (and dividend, tax withheld, interest, fee, transfer), with the Bank of
 * Israel dollar rate of its day and the amount in shekels. Copied from the
 * broker's own records, never edited after.
 */
@Schema({ collection: 'tax_records', timestamps: true })
export class TaxRecordDoc {
  /** The broker's id for the activity (unique: syncing twice adds nothing). */
  @Prop({ type: String, required: true, unique: true }) activityId: string;
  @Prop({ type: String, required: true }) broker: string;
  /** The broker account number. */
  @Prop({ type: String, required: true, index: true }) account: string;
  /** A paper (practice) account, or real money. */
  @Prop({ type: Boolean, required: true, index: true }) paper: boolean;
  @Prop({ type: String, required: true, index: true }) kind: TaxKind;
  @Prop({ type: String, required: true }) activityType: string;
  @Prop({ type: Date, required: true, index: true }) at: Date;
  /** The New York trading day (YYYY-MM-DD). */
  @Prop({ type: String, required: true }) day: string;
  @Prop({ type: String }) symbol?: string;
  @Prop({ type: Number }) qty?: number;
  @Prop({ type: Number }) priceUsd?: number;
  /** Trades: shares × price. Others: the cash moved, signed. */
  @Prop({ type: Number, required: true }) amountUsd: number;
  /** Shekels per dollar (Bank of Israel representative rate). */
  @Prop({ type: Number, required: true }) usdIls: number;
  /** The day of that rate (the trade's day, or the last published day before it). */
  @Prop({ type: String, required: true }) rateDate: string;
  @Prop({ type: Number, required: true }) amountIls: number;
  @Prop({ type: String }) orderId?: string;
  @Prop({ type: String }) description?: string;
}

export const TaxRecordSchema = SchemaFactory.createForClass(TaxRecordDoc);

/** The Bank of Israel's daily dollar rates, cached. */
@Schema({ collection: 'usd_ils_rates' })
export class UsdIlsRateDoc {
  @Prop({ type: String, required: true, unique: true }) date: string;
  @Prop({ type: Number, required: true }) rate: number;
}

export const UsdIlsRateSchema = SchemaFactory.createForClass(UsdIlsRateDoc);
