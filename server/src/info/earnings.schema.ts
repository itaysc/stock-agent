import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export interface EarningsReport {
  /** YYYY-MM-DD the results came out. */
  date: string;
  /** Beat (+) or miss (-) vs the analysts' estimate, in %; null for upcoming reports. */
  surprisePct: number | null;
}

/** A symbol's earnings dates, refreshed weekly. */
@Schema({ collection: 'earnings_reports', timestamps: true })
export class EarningsDoc {
  @Prop({ type: String, required: true, unique: true }) symbol: string;
  @Prop({ type: Date, required: true }) fetchedAt: Date;
  @Prop({ type: Array, required: true }) reports: EarningsReport[];
}

export const EarningsSchema = SchemaFactory.createForClass(EarningsDoc);
