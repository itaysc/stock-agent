import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** One session day's headlines; `pre*`: those published before the open (overnight, pre-market). */
export interface NewsDay {
  sum: number;
  count: number;
  preSum: number;
  preCount: number;
}

/** Format version: months saved by an older version are fetched again. */
export const NEWS_FORMAT = 2; // v2: before-open split

/** Headline tone per day for one symbol and month (fetched once, unless the month isn't over). */
@Schema({ collection: 'news_months', timestamps: true })
export class NewsMonth {
  @Prop({ type: String, required: true }) symbol: string;
  /** YYYY-MM */
  @Prop({ type: String, required: true }) month: string;
  /** Session day → headline tones and counts. */
  @Prop({ type: Object, required: true }) days: Record<string, NewsDay>;
  /** False for the current month: it's fetched again next time. */
  @Prop({ type: Boolean, required: true }) complete: boolean;
  @Prop({ type: Number, default: 1 }) v: number;
}

export const NewsMonthSchema = SchemaFactory.createForClass(NewsMonth);
NewsMonthSchema.index({ symbol: 1, month: 1 }, { unique: true });
